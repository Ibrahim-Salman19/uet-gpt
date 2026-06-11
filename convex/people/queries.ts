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
    let facultyCount = 0;
    let staffCount = 0;
    let adminCount = 0;
    let cursor: string | null = null;
    let isDone = false;

    while (!isDone) {
      const page = await ctx.db.query("documents").paginate({
        cursor,
        numItems: 200,
      });

      for (const doc of page.page) {
        const category = classifyDocument(doc.url.toLowerCase(), doc.title.toLowerCase());
        if (category === "faculty") facultyCount++;
        else if (category === "staff") staffCount++;
        else if (category === "admin") adminCount++;
      }

      cursor = page.continueCursor;
      isDone = page.isDone;
    }

    return {
      faculty: facultyCount,
      admin: adminCount,
      staff: staffCount,
      total: facultyCount + adminCount + staffCount,
    };
  },
});
