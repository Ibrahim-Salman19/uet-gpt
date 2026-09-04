# How We Built an Open-Source RAG Chatbot for a Pakistani University Using Next.js, Convex & Groq

*Students at UET Taxila needed fast answers about admissions, fees, and merit lists. So we built UET GPT, an open-source AI chatbot grounded in official university data.*

---

## The Problem

Every admissions season, University of Engineering and Technology (UET) Taxila students face the same chaos:

- **"What's the ECAT merit formula?"**
- **"How much is the BS fee structure?"**
- **"When do admissions close?"**

The answers exist, scattered across PDF prospectuses, university websites, and WhatsApp forwards. But there's no single place to ask a question and get a fast, accurate, *cited* answer.

We wanted to fix that.

---

## What We Built

[UET GPT](https://uet-gpt.vercel.app) is a free, open-source AI chatbot that answers any question about UET Taxila: admissions, ECAT, merit formulas, fee structures, departments, hostel allotment, scholarships, and campus life.

The key difference from a generic ChatGPT prompt: **every answer is grounded in official UET Taxila documents.** No hallucinations. Every response links back to its source.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, Tailwind CSS, TypeScript |
| Backend | Convex (real-time database + serverless functions) |
| Auth | Clerk |
| AI Models | Llama 4 Scout, Llama 3.1 8B (via Groq) |
| Vector Search | Convex vector indexes + Gemini embedding-2 |
| Crawler | Python (curl_cffi, trafilatura) |
| Deployment | Vercel |

---

## How the RAG Pipeline Works

RAG (Retrieval-Augmented Generation) is the core pattern. Here's how it flows:

### Step 1: Crawl Official Sources

A Python crawler continuously fetches content from:
- `web.uettaxila.edu.pk` (main university site)
- `admissions.uettaxila.edu.pk` (admissions portal)

It extracts clean text from HTML pages and PDF prospectuses using `trafilatura`.

### Step 2: Chunk & Embed

The crawled markdown gets split into overlapping chunks (~500 tokens each). Each chunk is embedded using **Gemini embedding-2** and stored in Convex vector indexes.

### Step 3: Retrieve on Query

When a student asks "What is the merit formula for CS?", the system:

1. **Classifies intent**, recognizes this as an admissions/merit query
2. **Hybrid search**, runs vector similarity + BM25 keyword search
3. **RRF fusion**, combines results using Reciprocal Rank Fusion
4. **Reranks**, applies a multi-tier reranker for precision

### Step 4: Generate with Citations

The top retrieved chunks are injected into the LLM prompt using a "Sandwich Strategy" (context before and after the query). The model generates a clear answer and explicitly cites its sources.

---

## Key Technical Decisions

### Why Convex?

We needed real-time updates (students see answers appear live) and a serverless backend that scales automatically. Convex gave us both, plus built-in vector search that eliminated the need for a separate Pinecone/Weaviate instance.

### Why Groq?

Latency matters for a chatbot. Groq's LPU inference gives us:
- **Llama 4 Scout**: ~50 tokens/sec for deep reasoning
- **Llama 3.1 8B**: ~100 tokens/sec for fast responses

Students get answers in under 2 seconds.

### Why Not Just Fine-Tune?

Fine-tuning a model on UET data would give us a model that *memorizes* facts but can't cite sources and goes stale when admissions change. RAG lets us:
- Update the knowledge base without retraining
- Cite exact source documents
- Maintain a clear boundary between "what the model knows" and "what the documents say"

---

## What We Learned Building It

### 1. The Crawler Is the Hardest Part

Everyone focuses on the LLM. But the real work is building a reliable crawler that handles:
- University websites with broken HTML
- PDF prospectuses with inconsistent formatting
- Admissions portals that change URLs every semester
- CAPTCHAs and rate limiting

We use `curl_cffi` (TLS fingerprint rotation) and `trafilatura` (clean text extraction) to handle most of this.

### 2. Chunking Strategy Matters More Than Model Choice

Bad chunks = bad retrieval = bad answers. We experimented with:
- Fixed-size chunking (too aggressive, splits sentences)
- Recursive splitting by headers (better, preserves context)
- Context-enriched chunks (adds surrounding context to each chunk)

Winner: **Recursive splitting with context enrichment.** Each chunk gets a summary of its parent section, so the retriever has more signal to work with.

### 3. Anti-Hallucination Is a Pipeline Problem, Not a Prompt Problem

Adding "don't hallucinate" to the prompt helps marginally. What actually works:

- **CRAG (Corrective RAG)**: An LLM judge evaluates retrieved results. If confidence is low, it tells the model to say "I don't have enough information" instead of guessing.
- **Source verification**: Every answer must reference a retrieved chunk. No chunk = no answer.
- **Conservative temperature**: We run at 0.3, factual, not creative.

### 4. Students Want Speed, Not Features

Our initial design had fancy UI animations, multi-step forms, and a complex thread system. User testing showed students just want:
1. Type a question
2. Get an answer fast
3. See where it came from

We simplified ruthlessly. The chat input is always visible. Answers stream in real-time. Sources are one click away.

---

## Open Source & Community

UET GPT is released under AGPL-3.0. The full source is on [GitHub](https://github.com/Ibrahim-Salman19/uet-gpt).

We built this as a community project, student-built, student-maintained, free for everyone. If you're a UET Taxila student, faculty member, or prospective applicant, try it out at [uet-gpt.vercel.app](https://uet-gpt.vercel.app).

If you're building something similar for your university, we'd love to help you get started. The architecture is designed to be portable, swap the crawler seeds and you have a RAG chatbot for any institution.

---

## What's Next

- **More sources**: Adding examination schedules, library catalogs, and transport routes
- **Multilingual support**: Urdu answers for students who prefer it
- **Mobile app**: Native iOS/Android experience
- **Community contributions**: PRs welcome, especially for crawling new UET Taxila pages

---

*Built with love by UET Taxila students. Free forever.*

**Try it:** [uet-gpt.vercel.app](https://uet-gpt.vercel.app)
**Source code:** [github.com/Ibrahim-Salman19/uet-gpt](https://github.com/Ibrahim-Salman19/uet-gpt)
**Questions?** Visit my [portfolio](https://ibrahimsalman.vercel.app) or reach out via [GitHub](https://github.com/Ibrahim-Salman19).
