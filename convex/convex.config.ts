import agent from "@convex-dev/agent/convex.config.js";
import rag from "@convex-dev/rag/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(rag);
app.use(agent);

export default app;
