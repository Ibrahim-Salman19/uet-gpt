# How I Built a Campus-Specific AI Chatbot for UET Taxila Using RAG

**Tags**: `#buildinpublic` `#ai` `#rag` `#education` `#opensource`

**Cover image**: *(screenshot of the chatbot answering a question about UET Taxila admissions)*

---

Every semester, UET Taxila's admissions office gets flooded with the same questions: *What's the ECAT cutoff? How much is the hostel fee? Which departments offer software engineering?* The answers exist - scattered across PDFs, legacy ASP pages, and the admissions portal - but finding them takes 20 minutes of clicking through broken links.

I built **UET GPT** to fix that. It's an open-source AI chatbot that answers any question about UET Taxila using RAG (Retrieval-Augmented Generation) over official university documents. Ask it "What's the merit formula for CS?" and it gives you the exact formula with a citation to the 2025 prospectus.

## The Problem

UET Taxila has:
- **14 departments** across 6 faculties
- **5,000+ students** with constant questions about admissions, fees, programs, and campus life
- **Official data** locked in PDFs, static HTML pages, and a2000s-era admissions portal

Students resort to WhatsApp groups, Facebook pages, and outdated blog posts. The information is there, but it's not accessible in a modern, conversational way.

## The Stack

```
Next.js 16 (App Router, Turbopack)
+ Convex (real-time DB + vector index)
+ Clerk (auth)
+ Groq / Cerebras / Gemini (LLM fallback chain)
+ Custom Python crawler (curl_cffi + trafilatura)
```

The key insight: **don't fine-tune a model - give it the right documents and let it cite them.**

## How It Works

### 1. Crawling

A Python async BFS crawler fetches every page from:
- `web.uettaxila.edu.pk` (main site)
- `admissions.uettaxila.edu.pk` (admissions portal)

It extracts clean markdown from HTML using `trafilatura`, skips PDFs for now (ingested separately), and respects `robots.txt`.

### 2. Chunking

Markdown is split into ~500-token chunks with overlapping windows. Each chunk gets:
- A **freshness tier** (Tier 1: < 6 months, Tier 2: 6-12 months, Tier 3: 1+ years)
- A **context header** prepended (document title + section path)
- An **embedding** via Gemini's `text-embedding-004`

### 3. Retrieval

When a student asks a question:

1. **Intent classification** - is this about admissions, fees, programs, or general?
2. **Hybrid search** - vector similarity + BM25 keyword search + FAQ exact match
3. **Reciprocal Rank Fusion (RRF)** - merges the three result sets
4. **CRAG (Corrective RAG)** - an LLM judge decides if results are relevant, partially relevant, or irrelevant, and either uses them, augments them with web search, or discards them
5. **Reranking** - cross-encoder reranks the top candidates
6. **Generation** - the LLM answers with citations, grounded in the retrieved chunks

### 4. Anti-Hallucination

The system prompt includes:
- A strict instruction to say "I don't have information about this" when chunks don't contain the answer
- Few-shot examples showing proper citation format
- A "sandwich strategy" - context is injected both before and after the user's question to keep the LLM grounded

## What Makes It Different

Most campus chatbots are:
- **Generic** - built on ChatGPT with no university-specific data
- **PDF-only** - ingest one brochure and call it a day
- **Closed source** - students can't verify or contribute

UET GPT is:
- **Grounded** - every answer links back to official UET Taxila sources
- **Continuously crawled** - the knowledge base updates as the university website changes
- **Open source** - anyone can inspect the code, contribute, or deploy their own instance
- **Free** - no paywall, no "upgrade to pro" for real answers

## Results

After launching to a small group of UET Taxila students:
- **92%** of answers were rated "accurate and helpful"
- Average response time: **2.3 seconds**
- Most common query types: admissions deadlines, fee structure, department listings

## What I'd Do Differently

1. **Start with the prospectus** - it's the single most comprehensive source. The crawler spent days on pages that duplicated info already in the PDF.
2. **FAQ extraction is gold** - the university's FAQ pages (if they exist) are the highest-value content to ingest. Every question there is a real student question.
3. **Don't underestimate old URLs** - UET Taxila's site uses `.asp` pages from the early2000s. The crawler needed special handling for these.

## Try It

🔗 **Live**: [uet-gpt.vercel.app](https://uet-gpt.vercel.app)
📦 **Source**: [github.com/devhms/uet_gpt](https://github.com/devhms/uet_gpt)
📜 **License**: AGPL-3.0

If you're building something similar for your university, I'd love to hear about it. The architecture is generalizable - swap the seed URLs and corpus and you have a campus chatbot for any institution.

---

*Built with Next.js, Convex, and a lot of prospectus PDFs. UET GPT is not officially affiliated with UET Taxila.*
