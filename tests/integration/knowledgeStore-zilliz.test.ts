import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import { afterAll, beforeAll, describe } from "vitest";
import { createZillizKnowledgeStore } from "../../convex/knowledgeStore/zillizAdapter";
import { ensureZillizSchema } from "../../convex/knowledgeStore/zillizSchema";
import { runKnowledgeStoreContractTests } from "./knowledgeStoreContract";

// Runs the shared KnowledgeStore contract against a real Zilliz Cloud
// cluster, on disposable *_test collections separate from the real
// benchmark corpus's knowledge_documents/knowledge_chunks (free tier caps
// at 5 collections - this suite + the real pair is 4, leaving headroom).
// Skips itself entirely (not a failure) when Zilliz credentials aren't
// configured, matching knowledgeStore-turso-cloud.test.ts's pattern.
//
// No manual flush anywhere in this file or in zillizAdapter.ts. Every read
// the adapter issues sets consistency_level: Strong explicitly, and that is
// sufficient on its own - confirmed via a minimal, isolated, no-flush,
// no-sleep reproduction (upsert -> Strong query sees it, upsert-over-same-
// key -> Strong query sees the update not the stale value, delete -> Strong
// query confirms absence, Strong search with ignore_growing:false finds the
// current state) that passed every step immediately. An earlier version of
// this file called flushSync() after every write and cleanup, reasoning
// from Milvus's general "flush ensures new data is queryable" troubleshooting
// docs - the wrong primary source for this specific cluster. Zilliz Cloud's
// own docs (docs.zilliz.com/docs/limits) say plainly "You are not advised
// to perform flush operations manually. Zilliz Cloud clusters handle it
// gracefully for you," and the flush-rate-limit that manual flushing was
// running into (0.1 requests/second/collection) is documented as applying
// to Serverless and Dedicated(beta) clusters specifically - NOT Free, which
// is what this project's cluster actually is (confirmed via the Zilliz
// control-plane Describe Cluster API: deploymentOption: "Free").

const address = process.env.ZILLIZ_ENDPOINT;
const token = process.env.ZILLIZ_API_KEY;
const hasZillizCredentials = Boolean(address && token);

const DOCUMENTS_TEST_COLLECTION = "knowledge_documents_test";
const CHUNKS_TEST_COLLECTION = "knowledge_chunks_test";

describe.skipIf(!hasZillizCredentials)("zilliz contract suite", () => {
  const client = new MilvusClient({ address: address!, token });

  beforeAll(async () => {
    if (hasZillizCredentials) {
      await ensureZillizSchema(client, DOCUMENTS_TEST_COLLECTION, CHUNKS_TEST_COLLECTION);
    }
  });

  afterAll(async () => {
    if (hasZillizCredentials) await client.closeConnection();
  });

  async function clearTestCollections(): Promise<void> {
    // Cloud cluster persists across tests (no "delete the file" reset
    // available) - clear data before each test so it starts from a clean
    // slate. Primary keys are never empty strings in practice, so this
    // filter matches every row without needing a real "delete all" verb.
    await client.delete({ collection_name: CHUNKS_TEST_COLLECTION, filter: 'chunk_key != ""' });
    await client.delete({ collection_name: DOCUMENTS_TEST_COLLECTION, filter: 'document_id != ""' });
  }

  runKnowledgeStoreContractTests("zilliz", async () => {
    await clearTestCollections();

    return {
      store: createZillizKnowledgeStore(client, DOCUMENTS_TEST_COLLECTION, CHUNKS_TEST_COLLECTION),
      ctx: undefined,
      cleanup: clearTestCollections,
    };
  });
});
