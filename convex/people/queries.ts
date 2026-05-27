import { query } from "../_generated/server";

export const getCount = query({
  args: {},
  handler: async (ctx) => {
    const documents = await ctx.db.query("documents").take(1000);

    let facultyCount = 0;
    let staffCount = 0;
    let adminCount = 0;

    for (const doc of documents) {
      const url = doc.url.toLowerCase();
      // Heuristic based on URL and title keywords for counting
      if (
        url.includes("faculty") ||
        url.includes("professor") ||
        doc.title.toLowerCase().includes("dr.") ||
        doc.title.toLowerCase().includes("prof.")
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

    return {
      faculty: facultyCount,
      admin: adminCount,
      staff: staffCount,
      total: facultyCount + adminCount + staffCount,
    };
  },
});
