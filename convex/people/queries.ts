import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAdmin } from "../auth";

export const getCount = query({
  args: {},
  returns: v.object({
    faculty: v.number(),
    admin: v.number(),
    staff: v.number(),
    total: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    let faculty = 0;
    let staff = 0;
    let admin = 0;
    let total = 0;

    let cursor: string | null = null;
    let isDone = false;

    // Single-pass table scan to build all counts concurrently, reducing read
    // amplification from 4x to 1x compared to running independent pagination loops.
    while (!isDone) {
      const pageResult = await ctx.db
        .query("documents")
        .paginate({ numItems: 1000, cursor });

      for (const doc of pageResult.page) {
        total++;
        if (doc.personType === "faculty") {
          faculty++;
        } else if (doc.personType === "staff") {
          staff++;
        } else if (doc.personType === "admin") {
          admin++;
        }
      }

      cursor = pageResult.continueCursor;
      isDone = pageResult.isDone;
    }

    return {
      faculty,
      admin,
      staff,
      total,
    };
  },
});
