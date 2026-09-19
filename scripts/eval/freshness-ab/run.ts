/**
 * Does correcting the freshness grounding rule change what the answer model does?
 *
 * Audit §18: `freshnessState` is derived purely from crawl recency vs a TTL
 * (convex/shared/freshnessPolicy.ts:classifyFreshness), so it means "we fetched this page
 * recently", NOT "this is the current edition". Measured over the §14 capture, 3 of the 4
 * dated URLs in the answer context are at least two editions behind - a 2017 journal, the
 * 2023 Rule Book, a 2024 event page - and ALL of them are rendered to the model as
 * "Freshness state: fresh / Applicability: current".
 *
 * The OLD rule told the model to treat exactly that as licence: "only present a value as
 * current if its source is marked fresh and current". A 2023 fee document passes that test,
 * which is the failure the rule existed to prevent. The NEW rule tells the model what the
 * labels actually mean and sends it to the year/session written in the source text.
 *
 * Holds retrieval fixed (the real production top-4 for "fee structure", frozen from the §14
 * capture, including the FAQ chunk that carries figures with NO year and the 2023 Rule Book)
 * and varies ONLY that one rule. Same model and temperature as production.
 *
 *   npx tsx scripts/eval/freshness-ab/run.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { isRefusalAnswer } from "../../../convex/shared/refusal";
import { buildSystemPrompt } from "../../../src/lib/prompt";

const ROOT = resolve(__dirname, "../../..");
const RUNS = 5;

function loadEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]!] = m[2]!.replace(/^"|"$/g, "");
  }
  return out;
}
const env = loadEnvFile(resolve(ROOT, ".env.vercel-production.local"));
const model = createGroq({ apiKey: env.GROQ_API_KEY! })("openai/gpt-oss-120b");

// The shipped rule, and the exact text it replaced, spliced into the real prompt so only
// this one line differs between arms.
const NEW_RULE =
  '- The "Retrieved", "Freshness state" and "Applicability" labels describe when this page was last fetched, NOT which edition its content is.';
const OLD_RULE =
  '- Treat each source\'s "Retrieved", "Freshness state", and "Applicability" labels as authoritative. For fees, deadlines, merit lists, admission or exam schedules, and eligibility, only present a value as current if its source is marked fresh and current; otherwise mention the session or retrieved date and tell the user to confirm on uettaxila.edu.pk.';

const QUESTION = "fee structure";
// Production top-4 for this query, rendered as buildContext does, with the freshness labels
// production actually emitted (fresh/current on every one of them).
const CONTEXT = `Source: [Frequently Asked Questions (FAQs)](https://admissions.uettaxila.edu.pk/FAQS.php)
Retrieved: 2026-09-14
Freshness tier: unknown
Freshness state: fresh
Applicability: current

## What is the fee structure for the first semester?
• Regular (Subsidized) ≈ Rs. 104,800 (without hostel)
• Partial-Subsidized (S & X categories) ≈ Rs. 339,800+
Exact fee is mentioned in the prospectus and on the fee structure page.

---

Source: [Rule Book -2023 - A5 Final.indd](https://admissions.uettaxila.edu.pk/Downloads/Rule-Book-2023.pdf)
Retrieved: 2026-09-14
Freshness tier: unknown
Freshness state: fresh
Applicability: current

##### **_Note:_**
- **_i. Percentage of Fee shall be applicable on all components of fee, except for security and admission charges._**
- **_ii. Timeline shall be calculated continuously covering both weekdays and weekend._**

---`;

function promptFor(arm: "old" | "new"): string {
  const prompt = buildSystemPrompt(CONTEXT, "admissions");
  if (arm === "new") return prompt;
  const idx = prompt.indexOf(NEW_RULE);
  if (idx === -1) {
    throw new Error(
      "The shipped NEW_RULE text is no longer in buildSystemPrompt's output - this harness " +
        "is comparing against the wrong baseline. Re-sync NEW_RULE with src/lib/prompt.ts.",
    );
  }
  const end = prompt.indexOf("\n", idx);
  return prompt.slice(0, idx) + OLD_RULE + prompt.slice(end);
}

// NOTE ON METRICS. `EDITION` does NOT discriminate and is kept only so the number is not
// silently dropped: it scored 5/5 under BOTH arms, because it matches words ("prospectus",
// "rule book", a bare year) that are present in the frozen context itself and so appear in
// any answer that quotes it. The discriminating measure is CONFIRM - whether the answer
// sends the user to the university to check - which the OLD rule produced 0/5 of and the
// NEW rule 4/5. That gap IS the defect: the old rule's own "otherwise ... tell the user to
// confirm" clause could never fire, because its precondition ("marked fresh and current")
// is satisfied by every chunk production retrieves, including 2017 and 2023 editions.
const EDITION = /\b(20\d{2}|fall|spring|session|edition|rule book|prospectus)\b/i;
const NO_YEAR_FLAG =
  /\b(does not (specify|state|mention)|no (specific )?(year|session|edition)|not stated|unspecified|isn'?t specified|does not indicate)\b/i;
const CONFIRM = /\b(confirm|verify|check)\b[^.]{0,60}\b(uettaxila|website|office)\b/i;

async function main() {
  let totalTokens = 0;
  for (const arm of ["old", "new"] as const) {
    const system = promptFor(arm);
    let qualified = 0;
    let refused = 0;
    let confirmed = 0;
    const samples: string[] = [];
    for (let i = 0; i < RUNS; i++) {
      const { text, usage } = await generateText({
        model,
        system,
        prompt: QUESTION,
        temperature: 0.3, // matches src/lib/chat/pipeline.ts
        maxOutputTokens: 2000,
        maxRetries: 2,
      });
      totalTokens += usage?.totalTokens ?? 0;
      const q = EDITION.test(text) || NO_YEAR_FLAG.test(text);
      if (q) qualified++;
      if (isRefusalAnswer(text)) refused++;
      if (CONFIRM.test(text)) confirmed++;
      if (i === 0) samples.push(text.replace(/\s+/g, " ").slice(0, 260));
    }
    console.log(`\n== ${arm.toUpperCase()} rule ==`);
    console.log(`  names an edition/session, or flags that none is stated : ${qualified}/${RUNS}`);
    console.log(`  tells the user to confirm with the university          : ${confirmed}/${RUNS}`);
    console.log(`  tripped the refusal detector (regression check)        : ${refused}/${RUNS}`);
    console.log(`  sample: ${samples[0]}`);
  }
  console.log(`\nprovider groq, ${totalTokens} tokens total across ${RUNS * 2} calls`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
