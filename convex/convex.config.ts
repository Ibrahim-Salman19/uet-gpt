import agent from "@convex-dev/agent/convex.config.js";
import rag from "@convex-dev/rag/convex.config.js";
import workflow from "@convex-dev/workflow/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(rag);
app.use(agent);
app.use(workpool, { name: "embeddingWorkpool" });
app.use(workpool, { name: "crawlWorkpool" });
app.use(workflow, { name: "crawlWorkflow" });

export default app;
