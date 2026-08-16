<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Resource safety (read before running any crawl, embedding, or bulk operation)

Local Convex is the default target for AI-agent development in this repo, not
cloud. Before running `scripts/crawler.py`, `scripts/ingest_pdf.py`, or any
crawl/embedding-triggering Convex function, read
`docs/runbooks/resource-safety-incident-response.md` - it covers local dev
setup, the emergency-stop/kill-switch mechanisms, and incident response. Do not
assume "continue" or "test this" authorizes a full crawl, a full re-embed, or
any cloud operation beyond what was explicitly scoped - each is a separate
authorization. Do not create another Convex deployment to work around a quota
or resource issue.
