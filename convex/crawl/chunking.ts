const MAX_SAFE_CHARS = 7200;

export function guardChunkSize(text: string): string[] {
  if (text.length <= MAX_SAFE_CHARS) return [text];
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  const result: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (buf.length + s.length > MAX_SAFE_CHARS && buf.length > 0) {
      result.push(buf.trim());
      buf = s;
    } else {
      buf += s;
    }
  }
  if (buf.trim()) result.push(buf.trim());
  return result.length > 1 ? result : [text.slice(0, MAX_SAFE_CHARS)];
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

  function getOverlap(text: string): string {
    if (!text || text.length <= overlapSize) return text;
    const tail = text.slice(-overlapSize);
    const splitIndex = tail.indexOf(" ");
    return splitIndex !== -1 ? tail.slice(splitIndex + 1) : tail;
  }

  function pushChunk(text: string) {
    const cleanText = text.trim();
    chunks.push({ text: cleanText, headingPath: [...headingStack] });
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
        currentChunk = isBlockHeader ? "" : getOverlap(currentChunk.trim());
      }

      if (block.trimStart().startsWith("|")) {
        const rows = block.split("\n");
        let currentTableChunk = currentChunk ? `${currentChunk}\n\n` : "";
        const header = rows.length > 2 ? `${rows[0]}\n${rows[1]}\n` : "";
        const startIndex = rows.length > 2 ? 2 : 0;

        for (let i = startIndex; i < rows.length; i++) {
          const row = `${rows[i]}\n`;
          if (currentTableChunk.length + row.length > maxChunkSize) {
            if (currentTableChunk) pushChunk(header + currentTableChunk);
            currentTableChunk = `${getOverlap(currentTableChunk.trim())}\n${row}`;
          } else {
            currentTableChunk += row;
          }
        }
        if (currentTableChunk) {
          pushChunk(header + currentTableChunk);
        }
        currentChunk = "";
      } else {
        const sentences: string[] = [];
        const ABBREVIATIONS =
          /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Ave|Dept|Univ|Fig|vs|etc|approx|dept|est|govt|inc|ltd|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\./g;
        const SENTINEL = "\u0000";
        const protectedBlock = block.replace(ABBREVIATIONS, "$1" + SENTINEL);
        const sentenceRegex = /[^.!?]+[.!?]+/g;
        let lastIndex = 0;
        while (true) {
          const match = sentenceRegex.exec(protectedBlock);
          if (match === null) break;
          sentences.push(match[0].replace(/\u0000/g, "."));
          lastIndex = sentenceRegex.lastIndex;
        }
        if (lastIndex < protectedBlock.length) {
          const trailing = protectedBlock.slice(lastIndex).replace(/\u0000/g, ".");
          if (trailing.trim()) {
            sentences.push(trailing);
          }
        }
        if (sentences.length === 0) {
          sentences.push(block);
        }

        const finalSentences: string[] = [];
        for (const s of sentences) {
          if (s.length > maxChunkSize) {
            const words = s.split(" ");
            let currentWordChunk = "";
            for (const word of words) {
              if (currentWordChunk.length + word.length + 1 > maxChunkSize) {
                if (currentWordChunk) finalSentences.push(currentWordChunk);
                currentWordChunk = word;
              } else {
                currentWordChunk += (currentWordChunk ? " " : "") + word;
              }
            }
            if (currentWordChunk) {
              finalSentences.push(currentWordChunk);
            }
          } else {
            finalSentences.push(s);
          }
        }

        let currentSentenceChunk = currentChunk ? `${currentChunk}\n\n` : "";
        const breadcrumb = getHeadingBreadcrumb();
        const breadcrumbPrefix = breadcrumb ? `${breadcrumb}\n\n` : "";

        for (const sentence of finalSentences) {
          if (currentSentenceChunk.length + sentence.length > maxChunkSize) {
            if (currentSentenceChunk) pushChunk(breadcrumbPrefix + currentSentenceChunk);
            currentSentenceChunk = `${getOverlap(currentSentenceChunk.trim())} ${sentence}`;
          } else {
            currentSentenceChunk += (currentSentenceChunk ? " " : "") + sentence;
          }
        }
        if (currentSentenceChunk) {
          pushChunk(breadcrumbPrefix + currentSentenceChunk);
          currentChunk = getOverlap(currentSentenceChunk.trim());
        } else {
          currentChunk = "";
        }
      }
    } else {
      const forceSplit = isBlockHeader && currentChunk.length > 50;

      if (currentChunk.length + block.length > maxChunkSize || forceSplit) {
        pushChunk(currentChunk);
        currentChunk = (isBlockHeader ? "" : `${getOverlap(currentChunk.trim())}\n\n`) + block;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + block;
      }
    }
  }

  if (currentChunk) {
    pushChunk(currentChunk);
  }

  return chunks.filter((c) => isQualityChunk(c.text) && c.text.length > 0);
}

export function normalizeContent(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/^[ \t]*\[[^\]]*\]\(#[^)]*\)[ \t]*\n?/gm, "")
    .replace(/^[ \t]*\|?[ \t]*---[ \t]*\|?[ \t]*\n?/gm, "")
    .replace(/^[ \t]*\|[ \t]*\|[ \t]*\n?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function assignFreshnessTier(url: string): "high" | "medium" | "low" {
  const lower = url.toLowerCase();
  if (
    lower === "https://web.uettaxila.edu.pk/" ||
    lower === "https://uettaxila.edu.pk/" ||
    lower.includes("admission") ||
    lower.includes("academic")
  ) {
    return "high";
  }
  if (lower.includes("department") || lower.includes("faculty")) {
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
