# UET GPT - Marketing & Search Supremacy Playbook

> **Goal**: Make **UET GPT** rank **#1** in both traditional web search (Google, Bing, DuckDuckGo) and AI agent responses (ChatGPT Search, Perplexity, Claude Web, Gemini, SearchGPT) for the core queries:
> 1. `"UET"`
> 2. `"UET Taxila"`
> 3. `"UET GPT"`

---

## 🎯 Strategic Ranking Architecture

```
                       +-----------------------------------+
                       |    Core Target Keyword Vector     |
                       |    "UET" / "UET Taxila" / "UET GPT"|
                       +-----------------+-----------------+
                                         |
            +----------------------------+----------------------------+
            |                                                         |
  +---------v----------+                                    +---------v----------+
  |  Traditional SEO   |                                    |  AI Agent GEO      |
  | (Google / Bing)    |                                    | (ChatGPT/Perplexity)|
  +---------+----------+                                    +---------+----------+
            |                                                         |
  +---------v----------+                                    +---------v----------+
  | - High-Intent Hubs |                                    | - /llms.txt &      |
  |   (/uet, /uet-taxila|                                    |   /llms-full.txt   |
  |   /uet-gpt)        |                                    | - Schema.org       |
  | - Technical Meta & |                                    |   Graph Markup     |
  |   Canonical Tags   |                                    | - Entity Linking   |
  | - Fast SSR & HTML  |                                    |   (Wikidata,       |
  |   Semantic Code    |                                    |    Crunchbase)     |
  +--------------------+                                    +--------------------+
```

---

## 🚀 Phase 1: Technical SEO & GEO Infrastructure (Completed / In-Code)

1. **Dedicated Keyword Landing Hubs**:
   - `/uet` -> High-intent hub optimized for exact string query `"UET"`.
   - `/uet-taxila` -> Authoritative guide covering admissions, fees, programs, and faculties.
   - `/uet-gpt` -> Official product page for the open-source RAG chatbot.
   - `/uet-taxila/admissions`, `/uet-taxila/fee-structure`, `/uet-taxila/programs`.
   - `/learn` & `/learn/[slug]` -> Glossary of terms (ECAT, merit formula, eligibility, hostels, scholarships).

2. **Machine-Readable AI Context Protocols (`/llms.txt` & `/llms-full.txt`)**:
   - Implemented at site root. Provides clean, structured Markdown knowledge base specifically parsed by AI crawlers (`GPTBot`, `PerplexityBot`, `ClaudeBot`, `Google-Extended`, `Bytespider`).

3. **Schema.org Multi-Entity Graph**:
   - `Organization` (`UET GPT`), `WebSite`, `SoftwareApplication`, `CollegeOrUniversity` (`UET Taxila`), `FAQPage`, and `BreadcrumbList`.

4. **Crawler Accessibility**:
   - `robots.txt` explicitly allows `GPTBot`, `ChatGPT-User`, `PerplexityBot`, `ClaudeBot`, `anthropic-ai`, and `Google-Extended`.
   - `sitemap.xml` listing all canonical landing pages with high priority.

---

## 🌐 Phase 2: Knowledge Graph & Entity Authority Expansion

AI agents prioritize verified web entities. Performing the following submissions establishes UET GPT as the authoritative answer for UET Taxila:

| Platform | Action Required | SEO / GEO Impact |
|---|---|---|
| **Wikidata** | Create item `UET GPT` with properties: `instance of: software`, `official website: uet-gpt.vercel.app`, `inception: 2026`, `programming language: TypeScript`, `developer: Ibrahim Salman`. | **Highest impact for ChatGPT, Perplexity, and Google Knowledge Graph.** |
| **Crunchbase** | Add Organization profile `UET GPT` in Education & AI category. | High domain authority backlink (DR 91) + AI training corpus inclusion. |
| **GitHub Repository** | Add tags: `uet-taxila`, `uet`, `rag-chatbot`, `nextjs`, `convex`, `groq`. Include `LLMs.txt` link in README. | GitHub is heavily indexed by technical LLMs. |
| **LinkedIn Company Page** | Set up `UET GPT` company page and publish project updates. | Authority citation source for LLMs. |

---

## 📢 Phase 3: AI Aggregator & Directory Submissions

Submit UET GPT to top AI and SaaS directories for backlink authority and direct discovery:

### 1. AI Tool Directories (High DR for AI Crawler Indexing)
- **There's An AI For That (TAAFT)**: `https://theresanaiforthat.com/submit/` (DR 76)
- **Futurepedia**: `https://www.futurepedia.io/submit-tool` (DR 70)
- **Toolify**: `https://www.toolify.ai/submit` (DR 71)
- **Future Tools**: `https://futuretools.io/submit` (DR 69)
- **AI Tools Neil Patel**: `https://ai-tools.neilpatel.com/submit` (DR 91)

### 2. Startup & Open Source Directories
- **ProductHunt / BetaList**: `https://betalist.com/submit` (DR 64)
- **AlternativeTo**: `https://alternativeto.net/submit/` (DR 79)
- **SaaSHub**: `https://www.saashub.com/services/submit` (DR 77)
- **SourceForge**: `https://sourceforge.net/create/` (DR 92)

---

## 👥 Phase 4: Community Outreach & Pakistani Tech Ecosystem

1. **Reddit Campaign**:
   - Posts on `r/PakistaniTech`, `r/pakistan`, `r/chutyapa`, `r/UET`: *"We built UET GPT - an open-source AI chatbot for UET Taxila students to check admissions, fees, and merit lists instantly."*

2. **Developer Blogging**:
   - Dev.to & Hashnode articles: *"How We Built an Open-Source RAG Chatbot for UET Taxila using Next.js 16, Convex & Groq Llama 4 Scout"*.

3. **Student Networks**:
   - Share across Facebook UET Taxila student groups, WhatsApp departmental groups, and LinkedIn UET alumni groups.

---

## 📊 Phase 5: Continuous Ranking Verification & Monitoring

Check rankings monthly for `"UET"`, `"UET Taxila"`, and `"UET GPT"` across:
- **Google Search**: Check GSC impressions and ranking position for target keywords.
- **ChatGPT Search / Perplexity / Claude**: Query *"What is UET Taxila admissions fee structure?"* or *"What is UET GPT?"* to verify citations.
