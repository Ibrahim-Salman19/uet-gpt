import { api } from "convex/_generated/api";
import type { ConvexHttpClient } from "convex/browser";
import { after } from "next/server";
import { assignFreshnessTier } from "../../../convex/crawl/chunking";

export function encodeSourcesHeader(sources: any[]): string {
  const jsonString = JSON.stringify(sources);
  const bytes = new TextEncoder().encode(jsonString);
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
  return btoa(binString);
}

export function buildCacheWriteCallback(
  question: string,
  ragResult: any,
  convex: ConvexHttpClient,
): (text: string, modelName: string) => void {
  return (text, modelName) => {
    if (ragResult.queryEmbedding && ragResult.queryEmbedding.length > 0) {
      after(async () => {
        try {
          let alternates = {};
          try {
            const altVal = await convex.action(
              (api as any)["cache/multiVector"].generateAlternates,
              { queryText: question },
            );
            if (altVal) {
              alternates = {
                alternateQueryTexts: altVal.alternateQueryTexts,
                alternateEmbeddings: altVal.alternateEmbeddings,
              };
            }
          } catch (e) {
            console.warn("Failed to generate alternate queries:", e);
          }

          const topSourceUrl =
            Array.isArray(ragResult.sources) && ragResult.sources[0]
              ? (ragResult.sources[0].url ?? "")
              : "";
          const freshnessTier = assignFreshnessTier(topSourceUrl);
          const sourceEntryIds = ragResult.sources.map((s: any) => s.entryId).filter(Boolean);

          await convex.action(api.cache.set.setFromServer, {
            secret: process.env.INTERNAL_API_SECRET,
            queryText: question,
            queryEmbedding: ragResult.queryEmbedding,
            response: text,
            sources: ragResult.sources,
            model: modelName,
            freshnessTier,
            sourceEntryIds,
            ...alternates,
          });
        } catch (err) {
          console.error("Failed to write to semantic cache:", err);
        }
      });
    }
  };
}
