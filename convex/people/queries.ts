import { query } from "../_generated/server";

export const getCount = query({
  args: {},
  handler: async (ctx) => {
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
        const url = doc.url.toLowerCase();
        const title = doc.title.toLowerCase();
        if (
          url.includes("faculty") ||
          url.includes("professor") ||
          title.includes("dr.") ||
          title.includes("prof.")
        ) {
          facultyCount++;
        } else if (url.includes("staff")) {
          staffCount++;
        } else if (
          url.includes("admin") ||
          url.includes("head") ||
          url.includes("registrar") ||
          url.includes("chancellor")
        ) {
          adminCount++;
        }
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
