/**
 * A/B for the GROUNDING_RULES fix, against the REAL production input.
 *
 * Reproduces production retrieval for the question that failed (rewrite -> HyDE ->
 * search -> cascadeRerank -> buildContext, the same sequence rag/retrieval.ts runs),
 * then asks the answer model the same question twice: once with the shipped prompt and
 * once with the pre-fix GROUNDING_RULES spliced back in. Only the two edited rules
 * differ, so any behaviour change is attributable to them.
 *
 * Gemini, not Groq: Groq's free daily budget rate-limited the live bot for ~24h once.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { isRefusalAnswer } from "../../../convex/shared/refusal";
import { buildSystemPrompt } from "../../../src/lib/prompt";

const ROOT = "/mnt/c/Users/hafiz/UETGPT/uet-gpt";
function readEnv(file: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(`${ROOT}/${file}`, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]!] = m[2]!.trim().replace(/^"|"$/g, "");
  }
  return env;
}
const prodEnv = readEnv(".env.vercel-production.local");
const localEnv = readEnv(".env.local");

const convex = new ConvexHttpClient(prodEnv.NEXT_PUBLIC_CONVEX_URL!, { logger: false });
// setAdminAuth is not in ConvexHttpClient's public typings, but it is what the existing
// scripts/eval/*.cjs gates use to reach internal actions with the deploy key.
(convex as unknown as { setAdminAuth(key: string): void }).setAdminAuth(prodEnv.CONVEX_DEPLOY_KEY!);

const QUESTION = "What is the fee structure for BS programs?";

// The exact text this change replaced, spliced back to build the pre-fix prompt.
const NEW_RULES =
  "- Answer ONLY from the reference data. Never use outside or general knowledge for UET Taxila facts (fees, dates, deadlines, merit, eligibility, seats, programmes, names, contacts, numbers). Do not guess. Only if the reference data contains NOTHING relevant to the question, say you couldn't find verified information about it and suggest checking uettaxila.edu.pk or contacting the relevant office.\n- If the reference data answers the question only partly, lead with the part it does support and then say plainly what is missing. Do not open with an apology or with \"I couldn't find verified information\" when the reference data does contain relevant facts - state those facts first, carrying whatever qualification the freshness rule below requires.";
const OLD_RULES =
  "- Answer ONLY from the reference data. Never use outside or general knowledge for UET Taxila facts (fees, dates, deadlines, merit, eligibility, seats, programmes, names, contacts, numbers). If the reference data does not contain the answer, say you couldn't find verified information about it and suggest checking uettaxila.edu.pk or contacting the relevant office. Do not guess.\n- If the reference data only partly answers the question, give the part it supports and say plainly what is missing.";

async function realProductionContext(): Promise<string> {
  const rewritten: string =
    (await convex.action(makeFunctionReference<"action">("rag/routing:rewriteQueryAction"), {
      query: QUESTION,
    })) || QUESTION;
  const hydeQuery: string = await convex.action(
    makeFunctionReference<"action">("rag/routing:hydeQueryAction"),
    { query: QUESTION },
  );
  const candidates: any[] = await convex.action(
    makeFunctionReference<"action">("embeddings/search:searchDocumentsAction"),
    { queryText: rewritten, hydeQuery, questionText: QUESTION, limit: 8 },
  );
  const ranked: any[] = await convex.action(
    makeFunctionReference<"action">("reranking/cascade:cascadeRerank"),
    {
      query: rewritten,
      documents: candidates.map((c) => ({ id: c.entryId, text: c.content })),
      topK: 4,
    },
  );
  const reranked = ranked.map((r) => ({ ...candidates[r.index], relevanceScore: r.score }));
  console.log(`  rewritten: ${rewritten.slice(0, 100)}`);
  console.log(`  topRerankScore: ${ranked[0]?.score?.toFixed(3)}  reranked: ${reranked.length}`);

  // "fee" makes classifyQueryRisk "high", so rag/retrieval.ts FORCES the CRAG judge even
  // above skipThreshold. The failing production request logged resultCount 2 - CRAG kept
  // 2 of 4 - so an A/B that skips CRAG feeds the model twice the supporting content and
  // cannot reproduce the failure.
  const cragEval: any[] = await convex.action(
    makeFunctionReference<"action">("rag/crag:evaluateChunks"),
    {
      query: QUESTION,
      chunks: reranked.map((c, i) => ({ text: c.content, index: i })),
    },
  );
  const final = reranked.filter((_, i) => {
    const e = cragEval.find((x) => x.index === i);
    return e ? e.relevant : true;
  });
  console.log(`  CRAG kept ${final.length}/${reranked.length} (production logged 2/4)`);
  for (const c of final) console.log(`    ${c.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 60)}`);

  return await convex.query(makeFunctionReference<"query">("rag/context:buildContext"), {
    chunks: final.map((r) => ({
      content: r.content,
      relevanceScore: r.relevanceScore,
      url: r.url,
      title: r.title,
      headingPath: r.headingPath,
      crawledAt: r.crawledAt,
      freshnessTier: r.freshnessTier,
      freshnessState: r.freshnessState,
      applicability: r.applicability,
    })),
    maxTokens: 3000,
  });
}

// Default to the model production actually answers with (LLM_FALLBACK_CHAIN[0]). An
// earlier run of this A/B on Gemini showed 0/3 refusals under BOTH prompts - Gemini never
// exhibited the bug, so it cannot distinguish the two rule sets. Verifying a prompt fix
// against a model other than the one that produced the defect verifies nothing.
const PROVIDER = process.argv.includes("--provider=google") ? "google" : "groq";
const model =
  PROVIDER === "google"
    ? createGoogleGenerativeAI({ apiKey: localEnv.GEMINI_API_KEY ?? localEnv.GEMINI_API_KEY_1! })(
        "gemini-3.5-flash-lite",
      )
    : createGroq({ apiKey: localEnv.GROQ_API_KEY! })("openai/gpt-oss-120b");

// The failing request logged cragTier null at topScore 0.7 -> tier "normal" -> EMPTY
// answerInstruction, so the grounding rules were the only thing shaping the reply.
const ANSWER_INSTRUCTION = "";
const RUNS = 5;

/**
 * The user-visible complaint is not "the answer contains refusal wording" - it is "the
 * answer OPENS by disclaiming instead of answering". isRefusalAnswer (the cache guard)
 * misses that: it scored "I'm sorry, but the available reference data only provides the
 * fee amounts for the first semester: Regular approximately Rs. 104,800..." as a normal
 * answer, because the phrase "verified information" never appears. Correct for the cache,
 * wrong as a measure of this fix. This measures the lead instead: an apology or an
 * explicit lack-statement standing before the first figure the answer gives.
 */
const APOLOGY = /\b(sorry|apolog|unfortunately|regret)/;
const LACK =
  /\b(could ?n'?t find|could not find|do ?n'?t have|does not (contain|include|provide|specify)|doesn'?t (contain|include|provide|specify)|no (verified|specific) information|not (available|provided|specified|detailed)|only (provides?|specifies|covers?|lists?|contains?)|the only .{0,40}(available|provided))/;

export function leadsWithCaveat(answer: string): boolean {
  const normalized = answer
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/\s+/g, " ");
  const firstFigure = normalized.search(/\d/);
  const lead = normalized.slice(0, firstFigure > 0 ? Math.min(firstFigure, 220) : 220);
  return APOLOGY.test(lead) || LACK.test(lead);
}

let totalTokens = 0;
const transcript: Array<{ arm: string; run: number; answer: string }> = [];

async function ask(system: string): Promise<string> {
  const { text, usage } = await generateText({
    model,
    system,
    messages: [{ role: "user", content: QUESTION }],
    // Match src/lib/chat/pipeline.ts exactly; at the SDK default temperature the answers
    // are noticeably more varied than production's.
    temperature: 0.3,
    maxOutputTokens: 2000,
  });
  totalTokens += usage?.totalTokens ?? 0;
  return text.trim();
}

// Retrieval is not deterministic: two consecutive runs returned different chunk sets,
// one of them with NO undergraduate source at all (two postgraduate fee tables). A model
// handed PG tables and asked about BS fees is CORRECT to say it found no verified BS
// information, so unpinned retrieval turns a retrieval defect into apparent prompt noise.
// Freeze once, then replay both arms against the identical context.
const FROZEN = `${ROOT}/scripts/eval/grounding-ab/frozen-context.json`;

(async () => {
  let context: string;
  if (process.argv.includes("--freeze") || !existsSync(FROZEN)) {
    console.log("== reproducing production retrieval (freezing) ==");
    context = await realProductionContext();
    writeFileSync(FROZEN, JSON.stringify({ question: QUESTION, context }, null, 2));
    console.log(`  frozen -> ${FROZEN}`);
  } else {
    context = JSON.parse(readFileSync(FROZEN, "utf8")).context;
    console.log(`== replaying frozen context (${context.length} chars) ==`);
  }

  const newPrompt = buildSystemPrompt(context, "academic", ANSWER_INSTRUCTION);
  if (!newPrompt.includes(NEW_RULES)) throw new Error("shipped prompt does not contain NEW_RULES");
  const oldPrompt = newPrompt.replace(NEW_RULES, OLD_RULES);
  if (oldPrompt === newPrompt) throw new Error("splice produced an identical prompt");

  for (const [label, system] of [
    ["OLD (pre-fix rules)", oldPrompt],
    ["NEW (shipped rules)", newPrompt],
  ] as const) {
    console.log(`\n== ${label} ==`);
    let refusals = 0;
    let caveatLeads = 0;
    for (let i = 0; i < RUNS; i++) {
      const answer = await ask(system);
      transcript.push({ arm: label, run: i + 1, answer });
      const refused = isRefusalAnswer(answer);
      const caveat = leadsWithCaveat(answer);
      if (refused) refusals++;
      if (caveat) caveatLeads++;
      const tag = refused ? "REFUSAL" : caveat ? "caveat-first" : "answers   ";
      console.log(`  run ${i + 1}: ${tag} | ${answer.slice(0, 130).replace(/\s+/g, " ")}`);
    }
    console.log(
      `  -> ${caveatLeads}/${RUNS} led with a caveat; ${refusals}/${RUNS} tripped the cache refusal guard`,
    );
  }
  // Groq's free daily budget for the answer model was exhausted once (2026-09-15) and
  // rate-limited the live chatbot for ~24h, so this run states what it spent.
  // Persisted so the answers can be re-scored with a different metric without spending
  // the answer model's free daily budget again.
  writeFileSync(
    `${ROOT}/scripts/eval/grounding-ab/last-run.json`,
    JSON.stringify(transcript, null, 2),
  );
  console.log(`\nprovider ${PROVIDER}, ${totalTokens} tokens total across ${RUNS * 2} calls`);
})().catch((e) => {
  console.error(String(e?.message ?? e).slice(0, 500));
  process.exit(1);
});
