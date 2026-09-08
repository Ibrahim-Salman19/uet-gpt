import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { TableNames } from "../_generated/dataModel";

// Migration tooling only (docs/SHIP.md Step 4 export/import identity-continuity
// plan). `npx convex export` has no per-table option and exports the whole
// deployment (all tables + component storage, e.g. the ~183MB
// @convex-dev/rag embeddings) as one server-side snapshot job - that OOM-
// killed the local self-hosted backend container when attempted against the
// 44,792-row crawledChunks table. This query lets a script page through one
// table at a time in small, bounded batches instead, so no single call holds
// more than one page in memory.
const EXPORTABLE_TABLES = [
  "users",
  "feedback",
  "adminAuditLog",
  "documents",
  "crawledChunks",
  "chunkParents",
  "faqs",
  "appSettings",
  "rateLimits",
  "evalResults",
  "sourceRegistry",
  "structuredFacts",
] as const;

export const exportTablePage = internalQuery({
  args: {
    table: v.union(...EXPORTABLE_TABLES.map((t) => v.literal(t))),
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  returns: v.object({
    page: v.array(v.any()),
    continueCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query(args.table as TableNames)
      .paginate({ numItems: args.numItems, cursor: args.cursor });
    return {
      page: result.page,
      continueCursor: result.isDone ? null : result.continueCursor,
      isDone: result.isDone,
    };
  },
});
