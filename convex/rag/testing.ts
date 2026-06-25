import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { type ActionCtx, action, internalMutation } from "../_generated/server";
import { rag } from "../rag/instance";

// Canonical admin authorization for actions: derive the role from the DB record
// of the authenticated user (matching eval.ts / cache/set.ts), NOT from an
// untyped/ad-hoc JWT claim. Fails closed and also enforces isActive.
async function requireAdminAuth(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }
  const user = await ctx.runQuery(internal.users.getByClerkIdInternal, {
    clerkId: identity.subject,
  });
  if (!user || !user.isActive || (user.role !== "admin" && user.role !== "superadmin")) {
    throw new ConvexError("Admin access required");
  }
}

// --- MUTATIONS (internal only — not callable from client) ---
export const insertTestChunk = internalMutation({
  args: {
    url: v.string(),
    title: v.string(),
    category: v.string(),
    entryId: v.optional(v.string()),
  },
  returns: v.id("documents"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const docData: {
      url: string;
      title: string;
      source: string;
      category: string;
      status: "indexed";
      entryId?: string;
      crawledAt: number;
      updatedAt: number;
    } = {
      url: args.url,
      title: args.title,
      source: new URL(args.url).hostname,
      category: args.category,
      status: "indexed",
      crawledAt: now,
      updatedAt: now,
    };
    if (args.entryId) {
      docData.entryId = args.entryId;
    }
    return await ctx.db.insert("documents", docData);
  },
});

// --- ACTIONS ---
export const seed = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    entryId: v.string(),
  }),
  handler: async (ctx) => {
    await requireAdminAuth(ctx);

    console.log("Seeding test document via RAG component...");
    const content =
      "The fee structure for BS Computer Science at UET Taxila for the 2024-25 academic year is: Tuition Fee: Rs. 45,000 per semester. Admission Fee: Rs. 15,000 (one-time). Hostel Fee: Rs. 12,000 per semester. Transport Fee: Rs. 8,000 per semester.";

    let entryId: string;
    try {
      const result = await rag.add(ctx, {
        namespace: "uet-global",
        text: content,
        filterValues: [
          { name: "category", value: "academic" },
          { name: "source", value: "uet" },
        ],
      });
      entryId = result.entryId;
    } catch (error) {
      console.error("Failed to add RAG entry:", error);
      throw error;
    }

    // Insert metadata document linked to the RAG entry
    // If this fails, clean up the RAG entry to avoid orphaned vector data
    try {
      await ctx.runMutation(internal.rag.testing.insertTestChunk, {
        url: "https://web.uettaxila.edu.pk/test-doc",
        title: "Test Document: BS Computer Science Fee Structure",
        category: "academic",
        entryId,
      });
    } catch (error) {
      console.warn("Failed to insert metadata document, cleaning up RAG entry:", error);
      try {
        await rag.delete(ctx, { entryId: entryId as unknown as import("@convex-dev/rag").EntryId });
      } catch {
        console.warn("Failed to clean up RAG entry after seed failure:", entryId);
      }
      throw error;
    }

    console.log("Seed complete! Entry ID:", entryId);
    return { success: true, entryId };
  },
});

export const verify = action({
  args: {},
  returns: v.object({ exists: v.boolean(), content: v.optional(v.string()), count: v.number() }),
  handler: async (ctx) => {
    await requireAdminAuth(ctx);

    const queryStr = "What is the fee for BS Computer Science?";
    console.log(`Verifying RAG pipeline with query: "${queryStr}"`);

    const { results, text } = await rag.search(ctx, {
      namespace: "uet-global",
      query: queryStr,
      limit: 5,
    });

    if (results.length === 0) {
      console.error("No results found. RAG index might not be ready or empty.");
      return { exists: false, count: 0 };
    }

    console.log(`Found ${results.length} chunks.`);
    console.log("\n--- VERIFICATION RESULT ---");
    console.log(`Top result score: ${results[0]?.score?.toFixed(4) ?? "N/A"}`);

    return {
      exists: true,
      content: text,
      count: results.length,
    };
  },
});
