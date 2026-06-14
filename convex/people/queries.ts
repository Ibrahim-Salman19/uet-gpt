import { query } from "../_generated/server";
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

export const getCount = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const faculty = await ctx.db
      .query("documents")
      .withIndex("by_personType", (q) => q.eq("personType", "faculty"))
      .collect();

    const staff = await ctx.db
      .query("documents")
      .withIndex("by_personType", (q) => q.eq("personType", "staff"))
      .collect();

    const admin = await ctx.db
      .query("documents")
      .withIndex("by_personType", (q) => q.eq("personType", "admin"))
      .collect();

    const total = await ctx.db
      .query("documents")
      .collect();

    return {
      faculty: faculty.length,
      admin: admin.length,
      staff: staff.length,
      total: total.length,
    };
  },
});
