import {
  CHILD_CHUNK_OVERLAP,
  CHILD_CHUNK_SIZE,
  computeChunkKey,
  PARENT_CHUNK_OVERLAP,
  PARENT_CHUNK_SIZE,
} from "./chunkKey";

const MAX_SAFE_CHARS = 7200;

export function guardChunkSize(text: string): string[] {
  if (text.length <= MAX_SAFE_CHARS) return [text];
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  const result: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (s.length > MAX_SAFE_CHARS) {
      if (buf.trim()) {
        result.push(buf.trim());
        buf = "";
      }
      const parts = wordSplitLongSentence(s, MAX_SAFE_CHARS);
      for (const part of parts) {
        if (buf.length + part.length > MAX_SAFE_CHARS && buf.length > 0) {
          result.push(buf.trim());
          buf = part;
        } else {
          buf += (buf ? " " : "") + part;
        }
      }
    } else if (buf.length + s.length > MAX_SAFE_CHARS && buf.length > 0) {
      result.push(buf.trim());
      buf = s;
    } else {
      buf += s;
    }
  }
  if (buf.trim()) result.push(buf.trim());
  return result.length > 0 ? result : [text.slice(0, MAX_SAFE_CHARS)];
}

export function isQualityChunk(text: string): boolean {
  const words = text.split(/\s+/).filter((w) => w.trim().length > 1);
  if (words.length < 5) return false;
  return true;
}

export interface ChunkResult {
  text: string;
  headingPath: string[];
}

function updateHeadingStack(stack: string[], headingText: string, level: number): string[] {
  const newStack = stack.slice(0, level - 1);
  const cleanText = headingText.replace(/^#+\s*/, "");
  if (newStack.length > 0 && newStack[newStack.length - 1] === cleanText) {
    return newStack;
  }
  newStack.push(cleanText);
  return newStack;
}

function headingLevel(line: string): number {
  const match = line.match(/^(#{1,6})\s/);
  return match ? match[1]!.length : 0;
}

const ABBREVIATIONS_RE =
  /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Ave|Dept|Univ|Fig|vs|etc|approx|dept|est|govt|inc|ltd|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\./g;
const SENTINEL = "\u0000";

function extractSentences(text: string): string[] {
  const protectedText = text.replace(ABBREVIATIONS_RE, "$1" + SENTINEL);
  const sentenceRegex = /[^.!?]+[.!?]+/g;
  const sentences: string[] = [];
  let lastIndex = 0;
  while (true) {
    const match = sentenceRegex.exec(protectedText);
    if (match === null) break;
    sentences.push(match[0].replace(/\u0000/g, "."));
    lastIndex = sentenceRegex.lastIndex;
  }
  if (lastIndex < protectedText.length) {
    const trailing = protectedText.slice(lastIndex).replace(/\u0000/g, ".");
    if (trailing.trim()) sentences.push(trailing);
  }
  return sentences.length > 0 ? sentences : [text];
}

function wordSplitLongSentence(sentence: string, maxChunkSize: number): string[] {
  const parts: string[] = [];
  const words = sentence.split(" ");
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > maxChunkSize) {
      if (current) parts.push(current);
      current = word;
    } else {
      current += (current ? " " : "") + word;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function getTableOverlapRows(text: string, overlapSize: number): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let overlap = "";
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (overlap.length + line.length > overlapSize) {
      if (overlap.length > 0) break;
    }
    overlap = line + "\n" + overlap;
  }
  return overlap.trim();
}

function chunkTableBlock(
  block: string,
  maxChunkSize: number,
  overlapSize: number,
  pushFn: (text: string) => void,
): string {
  const rows = block.split("\n");
  const header = rows.length > 2 ? `${rows[0]}\n${rows[1]}\n` : "";
  const startIndex = rows.length > 2 ? 2 : 0;
  let current = "";

  for (let i = startIndex; i < rows.length; i++) {
    const row = `${rows[i]}\n`;
    if (current.length + row.length > maxChunkSize) {
      if (current) pushFn(header + current);
      const overlap = getTableOverlapRows(current, overlapSize);
      current = overlap ? `${overlap}\n${row}` : row;
    } else {
      current += row;
    }
  }
  if (current) pushFn(header + current);
  return "";
}

function getOverlapText(text: string, overlapSize: number): string {
  if (!text || text.length <= overlapSize) return text;
  const tail = text.slice(-overlapSize);
  const splitIndex = tail.indexOf(" ");
  return splitIndex !== -1 ? tail.slice(splitIndex + 1) : tail;
}

export function chunkMarkdown(
  markdown: string,
  maxChunkSize: number = 3000,
  overlapSize: number = 300,
  initialHeadingPath?: string[],
): ChunkResult[] {
  const chunks: ChunkResult[] = [];
  const blocks = markdown.split(/\n{2,}/);
  let currentChunk = "";
  let headingStack = initialHeadingPath ? [...initialHeadingPath] : [];

  function pushChunk(text: string) {
    chunks.push({ text: text.trim(), headingPath: [...headingStack] });
  }

  function getHeadingBreadcrumb(): string {
    return headingStack.length > 0 ? headingStack.join(" > ") : "";
  }

  for (const block of blocks) {
    const trimmedBlock = block.trim();
    const level = headingLevel(trimmedBlock);
    const isBlockHeader = level > 0;

    if (isBlockHeader) {
      if (currentChunk) {
        pushChunk(currentChunk);
        currentChunk = "";
      }
      headingStack = updateHeadingStack(headingStack, trimmedBlock, level);
    }

    if (block.length > maxChunkSize) {
      if (currentChunk) {
        pushChunk(currentChunk);
        currentChunk = isBlockHeader ? "" : getOverlapText(currentChunk.trim(), overlapSize);
      }

      if (block.trimStart().startsWith("|")) {
        currentChunk = chunkTableBlock(block, maxChunkSize, overlapSize, pushChunk);
      } else {
        currentChunk = processSentencesBlock(
          block,
          maxChunkSize,
          overlapSize,
          getHeadingBreadcrumb(),
          currentChunk,
          pushChunk,
        );
      }
    } else {
      currentChunk = processSmallBlock(
        currentChunk,
        block,
        maxChunkSize,
        overlapSize,
        isBlockHeader,
        pushChunk,
      );
    }
  }

  if (currentChunk) pushChunk(currentChunk);
  return chunks.filter((c) => isQualityChunk(c.text) && c.text.length > 0);
}

function processSentencesBlock(
  block: string,
  maxChunkSize: number,
  overlapSize: number,
  headingBreadcrumb: string,
  carryOverlap: string,
  pushChunk: (text: string) => void,
): string {
  const sentences = extractSentences(block);
  const finalSentences = sentences.flatMap((s) =>
    s.length > maxChunkSize ? wordSplitLongSentence(s, maxChunkSize) : [s],
  );

  let sentenceChunk = carryOverlap ? `${carryOverlap}\n\n` : "";
  const prefix = headingBreadcrumb ? `${headingBreadcrumb}\n\n` : "";

  for (const sentence of finalSentences) {
    if (sentenceChunk.length + sentence.length > maxChunkSize) {
      if (sentenceChunk) pushChunk(prefix + sentenceChunk);
      sentenceChunk = `${getOverlapText(sentenceChunk.trim(), overlapSize)} ${sentence}`;
    } else {
      sentenceChunk += (sentenceChunk ? " " : "") + sentence;
    }
  }
  if (sentenceChunk) {
    pushChunk(prefix + sentenceChunk);
    return getOverlapText(sentenceChunk.trim(), overlapSize);
  }
  return "";
}

function processSmallBlock(
  currentChunk: string,
  block: string,
  maxChunkSize: number,
  overlapSize: number,
  isBlockHeader: boolean,
  pushChunk: (text: string) => void,
): string {
  const forceSplit = isBlockHeader && currentChunk.length > 50;
  if (currentChunk.length + block.length > maxChunkSize || forceSplit) {
    pushChunk(currentChunk);
    return (isBlockHeader ? "" : `${getOverlapText(currentChunk.trim(), overlapSize)}\n\n`) + block;
  }
  return currentChunk + (currentChunk ? "\n\n" : "") + block;
}

export function normalizeContent(text: string): string {
  let cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    // Remove lines that are just navigation links typical of header/sidebar menus
    .replace(/^[ \t]*[\*•-]?\s*\[?(Home|Admissions?|Academics?|Departments?|Faculties|Contact\s*Us|Downloads?|Gallery|Sitemap|Examinations?|Registrar|Careers?|About\s*Us|Research|News|Events|Notice\s*Board|Administration|Vice\s*Chancellor)\]?\(.*?\)[ \t]*\n?/gim, "")
    // Remove social media sharing / contact links
    .replace(/^[ \t]*[\*•-]?\s*\[?(Facebook|Twitter|LinkedIn|Instagram|Youtube|Pinterest|Google\+|RSS|Mail)\]?\(.*?\)[ \t]*\n?/gim, "")
    .replace(/^[ \t]*\[[^\]]*\]\(#[^)]*\)[ \t]*\n?/gm, "")
    .replace(/^[ \t]*\|[ \t]*\|[ \t]*\n?/gm, "");

  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  return cleaned;
}

export function assignFreshnessTier(url: string): "high" | "medium" | "low" {
  const lower = url.toLowerCase();
  // Time-sensitive student-critical content gets HIGH tier: steepest decay
  // penalty when stale + highest staleness re-crawl priority. Keep these
  // keywords in sync with assign_tier in scripts/crawler.py so the crawler's
  // push-time tier and the re-chunk path agree.
  const highKeywords = [
    "admission",
    "academic",
    "merit",
    "fee",
    "schedule",
    "seat",
    "result",
    "exam",
    "deadline",
    "notice",
    "scholarship",
    "prospectus",
  ];
  if (
    lower === "https://web.uettaxila.edu.pk/" ||
    lower === "https://uettaxila.edu.pk/" ||
    highKeywords.some((kw) => lower.includes(kw))
  ) {
    return "high";
  }
  if (lower.includes("department") || lower.includes("faculty") || lower.includes("program")) {
    return "medium";
  }
  return "low";
}

export function isPdfVirtualUrl(url: string): boolean {
  return url.startsWith("pdf://") || url.startsWith("https://uetgpt.local/pdf/");
}

export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

export function buildContextPrefix(title: string, url: string, isPdf: boolean): string {
  let prefix = `Document Title: ${title}\n`;
  if (!isPdf) {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.pathname && parsedUrl.pathname !== "/") {
        prefix += `URL Path: ${parsedUrl.pathname}\n`;
      }
    } catch {}
  }
  return prefix;
}

export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function generateContextSummary(text: string): Promise<string | null> {
  try {
    const geminiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GEMINI_API_KEY_1 ||
      process.env.GEMINI_API_KEY_2;
    if (!geminiKey) return null;
    if (text.split(/\s+/).length <= 500) return null;
    const { generateText } = await import("ai");
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    const googleInstance = createGoogleGenerativeAI({ apiKey: geminiKey });
    const { text: summary } = await generateText({
      model: googleInstance("gemini-2.5-flash"),
      prompt: `Write a 1-sentence summary of this document to provide context for vector search chunks. Document text:\n\n${text.slice(0, 2000)}`,
    });
    return summary.trim();
  } catch {
    return null;
  }
}

// A parent chunk, stored ONCE in the chunkParents table (WS-1). contentHash lets
// the caller dedup identical parents within a document instead of re-inserting.
export type ParentChunk = {
  contentHash: string;
  text: string;
};

// A child chunk. Carries parentContentHash (resolved to parentId by the caller
// mutation after the parent is upserted) instead of the full parentText - this
// removes the previous K× duplication of parent text across siblings.
//
// chunkKey (Phase 6.21A Part 2/8) is the chunk's STRUCTURAL identity - its
// position (heading breadcrumb + ordinal under that heading), independent of
// its text. contentHash remains the VALUE at that position: unchanged
// chunkKey + unchanged contentHash means truly nothing to do; unchanged
// chunkKey + changed contentHash means patch-in-place; a chunkKey with no
// prior row means a genuinely new position. This is what lets two
// byte-identical chunks at different positions both be stored (they get
// different chunkKeys), where the old contentHash-only identity collapsed
// them into one.
export type ChildChunk = {
  text: string;
  contentHash: string;
  parentContentHash: string;
  headingPath?: string[];
  chunkKey: string;
};

export type GenerateChunksResult = {
  parents: ParentChunk[];
  children: ChildChunk[];
};

export async function generateChunks(
  normalized: string,
  contextPrefix: string,
  documentUrl: string,
): Promise<GenerateChunksResult> {
  const parentChunks = chunkMarkdown(normalized, PARENT_CHUNK_SIZE, PARENT_CHUNK_OVERLAP);
  const parents: ParentChunk[] = [];
  const children: ChildChunk[] = [];
  // Tracks how many child chunks have already been produced under each exact
  // heading breadcrumb, in document order, across ALL parent blocks - the
  // ordinalWithinHeading component of chunkKey. Declared once per document
  // (not reset per-parent) so a heading path that legitimately recurs later
  // in the document still gets distinct, incrementing ordinals.
  const ordinalByHeading = new Map<string, number>();

  for (const parentChunk of parentChunks) {
    // Store each parent ONCE. Compute its hash once and reuse for all children
    // so siblings share a single chunkParents row (caller dedups by hash).
    const parentContentHash = await sha256(parentChunk.text);
    parents.push({ contentHash: parentContentHash, text: parentChunk.text });

    const childChunks = chunkMarkdown(
      parentChunk.text,
      CHILD_CHUNK_SIZE,
      CHILD_CHUNK_OVERLAP,
      parentChunk.headingPath,
    );
    for (const childChunk of childChunks) {
      const baseText = contextPrefix + childChunk.text;
      const guardedParts = guardChunkSize(baseText);
      for (const part of guardedParts) {
        const headingKey = (childChunk.headingPath ?? []).join(">");
        const ordinal = ordinalByHeading.get(headingKey) ?? 0;
        ordinalByHeading.set(headingKey, ordinal + 1);
        children.push({
          text: part,
          contentHash: await sha256(part),
          parentContentHash,
          headingPath: childChunk.headingPath,
          chunkKey: await computeChunkKey(documentUrl, childChunk.headingPath, ordinal),
        });
      }
    }
  }
  return { parents, children };
}
