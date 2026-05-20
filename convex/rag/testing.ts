import { v } from "convex/values";
import { api } from "../_generated/api";
import { action, mutation, query } from "../_generated/server";

// --- MUTATIONS ---
export const insertTestChunk = mutation({
  args: {
    content: v.string(),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    const documentId = await ctx.db.insert("documents", {
      title: "Test Document: BS Computer Science Fee Structure",
      url: "https://web.uettaxila.edu.pk/test-doc",
      content: args.content,
      indexedAt: Date.now(),
    });

    await ctx.db.insert("chunks", {
      documentId,
      content: args.content,
      embedding: args.embedding,
      chunkIndex: 0,
      createdAt: Date.now(),
    });

    return documentId;
  },
});

export const getChunkContent = query({
  args: { chunkId: v.id("chunks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.chunkId);
  },
});

// --- ACTIONS ---
export const seed = action({
  args: {},
  handler: async (ctx) => {
    console.log("Seeding test document...");
    const content =
      "The fee structure for BS Computer Science at UET Taxila for the 2024-25 academic year is: Tuition Fee: Rs. 45,000 per semester. Admission Fee: Rs. 15,000 (one-time). Hostel Fee: Rs. 12,000 per semester. Transport Fee: Rs. 8,000 per semester.";

    // 1. Embed the text
    console.log("Generating Gemini embedding...");
    const embedding = await ctx.runAction(api.embeddings.generate.generate, { text: content });

    // 2. Insert into Vector DB
    console.log("Inserting document into chunks table...");
    const documentId = await ctx.runMutation(api.rag.testing.insertTestChunk, {
      content,
      embedding,
    });

    console.log("✅ Seed complete! Document ID:", documentId);
    return { success: true, documentId };
  },
});

export const verify = action({
  args: {},
  handler: async (ctx) => {
    const queryStr = "What is the fee for BS Computer Science?";
    console.log(`Verifying RAG pipeline with query: "${queryStr}"`);

    // 1. Embed query
    console.log("Generating query embedding...");
    const queryEmbedding = await ctx.runAction(api.embeddings.generate.generate, {
      text: queryStr,
    });

    // 2. Search vector index
    console.log("Executing ctx.vectorSearch...");
    const results = await ctx.vectorSearch("chunks", "by_embedding", {
      vector: queryEmbedding,
      limit: 5,
    });

    if (results.length === 0) {
      console.error("❌ No results found. Vector index might not be ready or empty.");
      return { success: false, results: [] };
    }

    // 3. Output results
    console.log(`Found ${results.length} chunks.`);
    const formattedResults = await Promise.all(
      results.map(async (r: any) => {
        const chunk = await ctx.runQuery(api.rag.testing.getChunkContent, { chunkId: r._id });
        return {
          id: r._id,
          score: r._score,
          text: chunk?.content?.substring(0, 100) + "...",
        };
      }),
    );

    console.log("\n--- VECTOR SEARCH RESULTS ---");
    formattedResults.forEach((res, i) => {
      console.log(`[${i + 1}] Score: ${res.score.toFixed(4)}`);
      console.log(`    Text: ${res.text}`);
      if (res.score > 0.85) {
        console.log(`    ✅ SUCCESS: High similarity match!`);
      } else {
        console.log(`    ⚠️ WARNING: Low similarity match.`);
      }
    });

    return formattedResults;
  },
});
