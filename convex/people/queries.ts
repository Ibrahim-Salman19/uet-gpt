import { type QueryCtx, query } from "../_generated/server";
import { requireAdmin } from "../auth";

const FACULTY_PATTERNS = ["faculty", "professor", "dr.", "prof."];
const STAFF_PATTERNS = ["staff"];
const ADMIN_PATTERNS = ["admin", "head", "registrar", "chancellor"];

function classifyDocument(url: string, title: string): "faculty" | "staff" | "admin" | null {
  const text = `${url} ${title}`.toLowerCase();
  if (FACULTY_PATTERNS.some((p) => text.includes(p))) return "faculty";
  if (STAFF_PATTERNS.some((p) => text.includes(p))) return "staff";
  if (ADMIN_PATTERNS.some((p) => text.includes(p))) return "admin";
  return null;
}

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
