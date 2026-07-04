import { ConvexError, v } from "convex/values";
import { internalQuery } from "../_generated/server";

type DocQueryResult = {
  url: string;
  title: string;
  category: string;
  crawledAt?: number;
  freshnessTier?: string;
  parentText?: string;
  headingPath?: string[];
  contextualizedText?: string;
};

export const getDocumentByEntryId = internalQuery({
  args: { entryId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      url: v.string(),
      title: v.string(),
      category: v.string(),
      crawledAt: v.optional(v.number()),
      freshnessTier: v.optional(v.string()),
      parentText: v.optional(v.string()),
      headingPath: v.optional(v.array(v.string())),
      contextualizedText: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args): Promise<DocQueryResult | null> => {
    const chunk = await ctx.db
      .query("crawledChunks")
      .withIndex("by_ragId", (q) => q.eq("ragId", args.entryId))
      .unique();

    if (chunk) {
      const doc = await ctx.db.get(chunk.documentId);
      if (doc) {
        return {
          url: doc.url,
          title: doc.title,
          category: doc.category,
          crawledAt: doc.crawledAt ?? undefined,
          freshnessTier: doc.freshnessTier ?? undefined,
          parentText: chunk.parentText,
          headingPath: chunk.headingPath,
          contextualizedText: chunk.contextualizedText,
        };
      }
    }

    const doc = await ctx.db
      .query("documents")
      .withIndex("by_entryId", (q) => q.eq("entryId", args.entryId))
      .unique();

    if (!doc) return null;

    return {
      url: doc.url,
      title: doc.title,
      category: doc.category,
      crawledAt: doc.crawledAt ?? undefined,
      freshnessTier: doc.freshnessTier ?? undefined,
      parentText: undefined,
      headingPath: undefined,
      contextualizedText: undefined,
    };
  },
});

export const getDocumentsByEntryIds = internalQuery({
  args: { entryIds: v.array(v.string()) },
  returns: v.array(
    v.object({
      entryId: v.string(),
      doc: v.union(
        v.null(),
        v.object({
          url: v.string(),
          title: v.string(),
          category: v.string(),
          crawledAt: v.optional(v.number()),
          freshnessTier: v.optional(v.string()),
          parentText: v.optional(v.string()),
          headingPath: v.optional(v.array(v.string())),
          contextualizedText: v.optional(v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    if (args.entryIds.length > 100)
      throw new ConvexError("Cannot query more than 100 entry IDs at a time");

    // Step 1: Parallel indexed lookups — O(k) instead of O(n) full table scan
    const chunks = await Promise.all(
      args.entryIds.map((entryId) =>
        ctx.db
          .query("crawledChunks")
          .withIndex("by_ragId", (q) => q.eq("ragId", entryId))
          .first(),
      ),
    );

    // Step 2: Batch-fetch parent documents for chunks that were found
    const docIds = chunks
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .map((c) => c.documentId);
    const uniqueDocIds = [...new Set(docIds)];
    const docs = await Promise.all(uniqueDocIds.map((id) => ctx.db.get(id)));
    const docsById = new Map(docs.filter(Boolean).map((d) => [d!._id, d!]));

    // Step 3: Identify entryIds that need fallback (no chunk or missing doc)
    const missingEntryIds: string[] = [];
    const entryChunkMap = new Map(args.entryIds.map((entryId, i) => [entryId, chunks[i]]));
    for (const entryId of args.entryIds) {
      const chunk = entryChunkMap.get(entryId);
      if (!chunk || !docsById.has(chunk.documentId)) {
        missingEntryIds.push(entryId);
      }
    }

    // Step 4: Parallel fallback for missing entryIds
    const fallbackDocs = await Promise.all(
      missingEntryIds.map((entryId) =>
        ctx.db
          .query("documents")
          .withIndex("by_entryId", (q) => q.eq("entryId", entryId))
          .unique(),
      ),
    );
    const fallbackByEntryId = new Map(
      missingEntryIds.map((entryId, i) => [entryId, fallbackDocs[i]]),
    );

    // Step 5: Build results
    return args.entryIds.map((entryId) => {
      const chunk = entryChunkMap.get(entryId);
      if (chunk) {
        const doc = docsById.get(chunk.documentId);
        if (doc) {
          return {
            entryId,
            doc: {
              url: doc.url,
              title: doc.title,
              category: doc.category,
              crawledAt: doc.crawledAt ?? undefined,
              freshnessTier: doc.freshnessTier ?? undefined,
              parentText: chunk.parentText,
              headingPath: chunk.headingPath,
              contextualizedText: chunk.contextualizedText,
            },
          };
        }
      }
      // Fallback: documents table by entryId
      const fallbackDoc = fallbackByEntryId.get(entryId);
      if (fallbackDoc) {
        return {
          entryId,
          doc: {
            url: fallbackDoc.url,
            title: fallbackDoc.title,
            category: fallbackDoc.category,
            crawledAt: fallbackDoc.crawledAt ?? undefined,
            freshnessTier: fallbackDoc.freshnessTier ?? undefined,
            parentText: undefined,
            headingPath: undefined,
            contextualizedText: undefined,
          },
        };
      }
      return { entryId, doc: null };
    });
  },
});
