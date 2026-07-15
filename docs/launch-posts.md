# Product Hunt Launch

## Tagline
**UET GPT — The AI chatbot that knows everything about UET Taxila**

## Description
UET GPT is an open-source AI chatbot that answers any question about UET Taxila — Pakistan's premier engineering university — using RAG over official university documents.

Ask it about admissions, fees, programs, faculty, campus life — get instant, cited answers grounded in the university's own data.

🔗 Live: https://uet-gpt.vercel.app
📦 Source: https://github.com/devhms/uet_gpt
📜 License: AGPL-3.0

## Maker Comment
Hey Product Hunt! 👋

I built UET GPT because every semester, UET Taxila students ask the same questions: "What's the ECAT cutoff?", "How much is hostel fee?", "Which departments offer SE?". The answers exist — locked in PDFs and a2000s-era admissions portal — but finding them takes forever.

UET GPT uses RAG (Retrieval-Augmented Generation) over official university data, so every answer is grounded and cited. It's free, open-source, and built for students by someone who understands the pain.

The stack: Next.js + Convex + Groq/Cerebras/Gemini fallback chain. The crawler continuously indexes the university website, so the knowledge base stays fresh.

If you're building something similar for your campus, I'd love to connect!

---

# Show HN: UET GPT — Open-source AI chatbot for a Pakistani engineering university

**URL**: https://uet-gpt.vercel.app
**GitHub**: https://github.com/devhms/uet_gpt

## Post Body

I built an RAG-powered AI chatbot that answers questions about UET Taxila (a public engineering university in Pakistan with 5,000+ students).

**The problem**: Students waste hours digging through PDFs, legacy ASP pages, and a2000s-era admissions portal to find basic info like fee structures, admission deadlines, and department listings.

**The solution**: A chatbot that crawls the official university website, ingests the prospectus, and answers questions with citations.

**How it works**:
- Python async BFS crawler fetches every page from web.uettaxila.edu.pk and admissions.uettaxila.edu.pk
- Markdown is chunked, embedded (Gemini text-embedding-004), and stored in Convex's native vector index
- Retrieval uses hybrid search (vector + BM25 + FAQ exact match) with Reciprocal Rank Fusion
- CRAG (Corrective RAG) LLM judge validates results before generation
- Fallback chain: Groq → Cerebras → Gemini for resilience

**What makes it different**:
- Grounded in official data — every answer links to the source
- Continuously crawled — knowledge base stays current
- Open source (AGPL-3.0) — inspect, contribute, or fork for your campus
- Free — no paywall

**Stack**: Next.js 16, Convex, Clerk, Vercel AI SDK, Python crawler (curl_cffi + trafilatura)

Looking for feedback on the RAG pipeline architecture and suggestions for improving citation accuracy.
