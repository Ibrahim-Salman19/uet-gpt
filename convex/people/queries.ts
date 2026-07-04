import { type QueryCtx, query } from "../_generated/server";
import { requireAdmin } from "../auth";

// NOTE: document classification (the FACULTY/STAFF/ADMIN pattern matching) lives
// in convex/doc/create.ts and is persisted to `documents.personType` at create
// time. This query reads the persisted value via the `by_personType` index, so
// no local classifier is needed here — a former copy was dead code and removed.

async function countDocuments(ctx: QueryCtx, filterType?: "faculty" | "staff" | "admin") {
  let count = 0;
  let cursor: string | null = null;
  let isDone = false;
  while (!isDone) {
    const query = filterType
      ? ctx.db.query("documents").withIndex("by_personType", (q) => q.eq("personType", filterType))
      : ctx.db.query("documents");
    const pageResult = await query.paginate({ numItems: 1000, cursor });
    count += pageResult.page.length;
    cursor = pageResult.continueCursor;
    isDone = pageResult.isDone;
  }
  return count;
}

export const getCount = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const [faculty, staff, admin, total] = await Promise.all([
      countDocuments(ctx, "faculty"),
      countDocuments(ctx, "staff"),
      countDocuments(ctx, "admin"),
      countDocuments(ctx, undefined),
    ]);

    return {
      faculty,
      admin,
      staff,
      total,
    };
  },
});
