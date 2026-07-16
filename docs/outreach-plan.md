# UET GPT - Discoverability & Outreach Plan

> Goal: earn high-authority backlinks + citations so UET GPT (https://uet-gpt.vercel.app) ranks for "UET Taxila", "UET GPT", "UET admissions", and gets cited by AI agents (ChatGPT / Perplexity / Claude).
> Repo: https://uet-gpt.vercel.app · Live: https://uet-gpt.vercel.app
> Current GitHub description: *"UET GPT - AI-powered RAG chatbot for University of Engineering and Technology, Taxila. Get instant answers about admissions, fees, programs, faculty, and campus life."*

---

## 1. Prioritized submission table

Priority = expected SEO/citation value × relevance × effort. P1 = do first.

| # | Priority | Site | URL | What to submit | Account needed? | Link type |
|---|----------|------|-----|----------------|-----------------|-----------|
| 1 | P1 | **GitHub topics optimization** | uet-gpt.vercel.app | Add repo topics + description (see §3) | GitHub login (you own repo) | n/a (repo is the asset) |
| 2 | P1 | **Product Hunt** | producthunt.com/posts/new | "UET GPT" launch: tagline, link, 3 screenshots, first-comment hunt | Account (free) | Dofollow |
| 3 | P1 | **Show HN (Hacker News)** | news.ycombinator.com/submit | Title: `Show HN: UET GPT – open-source RAG chatbot for UET Taxila`; URL + honest technical blurb | HN account (free) | Nofollow |
| 4 | P1 | **There's An AI For That** | theresanaiforthat.com/submit | Free tool listing, category "Education / Student Help", link | Account (free) | Dofollow |
| 5 | P1 | **Futurepedia** | futurepedia.io/submit | AI tool listing w/ description + logo + screenshots | Account (free) | Dofollow |
| 6 | P2 | **Toolify** | toolify.ai/submit | AI tool profile, pricing = Free, use-case examples | Account (free) | Dofollow |
| 7 | P2 | **BetaList** | betalist.com/submit | Startup early-access listing | Account (free, review queue) | Dofollow |
| 8 | P2 | **AlternativeTo** | alternativeto.net | List as alternative to "Google / university site search"; tag open-source | Account (free) | Dofollow |
| 9 | P2 | **uNeed** | uneed.best | AI tool submit | Account (free) | Dofollow |
| 10 | P2 | **dev.to** | dev.to | Publish "How we built UET GPT - an open-source RAG chatbot for UET Taxila" (links back) | Account (free) | Dofollow |
| 11 | P2 | **Hashnode** | hashnode.com | Same article cross-posted, canonical to dev.to | Account (free) | Dofollow |
| 12 | P3 | **AIToolsRecap** | aitoolsrecap.com | Tool submit for editorial coverage | Form/email (free) | Dofollow |
| 13 | P3 | **Submit AI Tools** | submitaitools.org/submit-your-ai-tool | Free AI directory listing | Form (free) | Dofollow |
| 14 | P3 | **AISO Tools** | aisotools.com | AI-search-optimized directory (good for agent citation) | Account (free) | Dofollow |
| 15 | P3 | **AI Tools Directory** | aitoolsdirectory.com/submit-tool | Free listing | Form (free) | Dofollow |
| 16 | P3 | **Indie Hackers** | indiehackers.com/products | Product page + story | Account (free) | Dofollow |
| 17 | P3 | **SourceForge** | sourceforge.net/p/add_project | Add project (mirror repo) | Account (free) | Nofollow |
| 18 | P2 | **r/Pakistan** | reddit.com/r/Pakistan | Helpful post: "I built a free AI chatbot for UET Taxila admissions/fees" (no spam, value-first) | Reddit account (aged) | Nofollow |
| 19 | P2 | **r/Islamabad** | reddit.com/r/islamabad | Local student audience | Reddit account | Nofollow |
| 20 | P3 | **LinkedIn – UET Taxila alumni / GDSC UET Taxila** | linkedin.com/company/uettaxilaofficial · linkedin.com/company/gdscuett | Post announcing the tool; tag university societies | LinkedIn account | Nofollow |
| 21 | P3 | **Facebook – UET Taxila page / student groups** | facebook.com/UETTaxilas | Share in comments/groups (respect group rules) | Facebook account | Nofollow |
| 22 | P2 | **UET Taxila official site (webmaster outreach)** | uettaxila.edu.pk / admissions portal | Request a link from a student-resources / useful-links page | Email to ORIC/webmaster | Dofollow (highest value) |

**Notes on relevance:** Items 18–22 are the highest *relevance* (geo + audience) but lowest link-type SEO value (mostly nofollow). They still drive real users and direct citations. Item 22 (official university link) is the single most valuable backlink if obtainable.

---

## 2. Ready-to-paste copy

### SHORT description (~160 chars - use for Product Hunt tagline, directory one-liners, HN title support)

> UET GPT is a free, open-source AI chatbot for UET Taxila that answers questions on admissions, fees, programs, faculty, and campus life using official university data.

(159 chars)

### LONG description (~600 chars - use for directory "about" fields, dev.to intro, LinkedIn/Reddit body)

> UET GPT is a free, open-source AI chatbot built as the intelligent guide to the University of Engineering and Technology (UET), Taxila, Pakistan. It uses a Retrieval-Augmented Generation (RAG) pipeline that crawls and indexes official UET Taxila web pages and documents, then answers student questions in plain language with source citations.
>
> Students can ask about admissions, fee structures, academic programs, departments, faculty, transport routes, hostels, scholarships, and examinations - and get instant, citation-backed answers instead of digging through PDFs. The stack is Next.js + Convex (vector search) + Clerk auth, with a multi-model LLM fallback chain (Groq → Cerebras → Gemini).
>
> Try it free at https://uet-gpt.vercel.app or explore the open-source code at https://uet-gpt.vercel.app.

(~600 chars)

### Show HN post body (paste after title `Show HN: UET GPT – open-source RAG chatbot for UET Taxila`)

> Hi HN! I built UET GPT, an open-source RAG chatbot that answers questions about UET Taxila (a major engineering university in Pakistan) - admissions, fees, programs, faculty, hostels, scholarships.
>
> It continuously crawls official university pages/PDFs, chunks them, and retrieves with hybrid vector + BM25 search + reranking, then generates citation-backed answers. Stack: Next.js, Convex (vector index), Clerk, Vercel AI SDK with a Groq→Cerebras→Gemini fallback.
>
> Live: https://uet-gpt.vercel.app · Code: https://uet-gpt.vercel.app
> Would love feedback on the retrieval/reranking approach and hallucination guard.

---

## 3. Recommended GitHub repo description + topics

**Description (replace current):**
```
UET GPT - open-source RAG chatbot & intelligent guide to UET Taxila (Pakistan). Instant, citation-backed answers on admissions, fees, programs, faculty, and campus life.
```

**Topics to set** (add the missing ones; keep existing relevant tags):
```
uet-gpt, uet-taxila, uet, uet-pakistan, ai-chatbot, rag, rag-chatbot,
education, edtech, pakistan, student-help, retrieval-augmented-generation,
nextjs, convex, clerk, vector-search, open-source
```

**Run by user** (these mutate the repo - DO NOT run automatically):
```bash
gh repo edit uet-gpt \
  --description "UET GPT - open-source RAG chatbot & intelligent guide to UET Taxila (Pakistan). Instant, citation-backed answers on admissions, fees, programs, faculty, and campus life."

gh repo edit uet-gpt \
  --add-topic uet-gpt --add-topic uet-taxila --add-topic uet \
  --add-topic uet-pakistan --add-topic ai-chatbot --add-topic rag \
  --add-topic rag-chatbot --add-topic education --add-topic edtech \
  --add-topic pakistan --add-topic student-help \
  --add-topic retrieval-augmented-generation --add-topic nextjs \
  --add-topic convex --add-topic clerk --add-topic vector-search \
  --add-topic open-source
```

> These commands are safe and idempotent for the owner. `gh` must be authed (`gh auth login`) first.

---

## 4. Manual vs. automatable

**Requires manual action by the user (accounts / logins / human judgment):**
- Product Hunt launch (account, scheduled hunt, first-comment engagement).
- Show HN submission + staying in comments to answer feedback.
- All directory sign-ups (TAAFT, Futurepedia, Toolify, BetaList, AlternativeTo, uNeed, AIToolsRecap, Submit AI Tools, AISO, AI Tools Directory, Indie Hackers, SourceForge).
- Writing + publishing the dev.to / Hashnode article (can be drafted by AI, must be posted by you).
- Reddit posts (need an aged account; value-first, not spam).
- LinkedIn / Facebook posts to university communities.
- **Official UET Taxila link request** - email ORIC/webmaster (highest-value backlink; purely manual outreach).

**Automatable / scriptable (by an agent, no account risk):**
- Running the `gh repo edit` commands above (owner-authed, read-only-safe mutation of your own repo) - flagged "run by user" but trivially automatable once you approve.
- Generating the submission kit assets: logo (512px), 3 screenshots, 60-char tagline, 150-word description (already provided above).
- Drafting the dev.to/Hashnode article and Reddit/LinkedIn post text.
- Maintaining a tracking spreadsheet (directory, date, listing URL, free/paid).

**Suggested sequence:** (1) GitHub topics + description → (2) prep submission kit → (3) Product Hunt + Show HN launch week → (4) TAAFT + Futurepedia + Toolify → (5) BetaList/AlternativeTo/uNeed → (6) dev.to + Hashnode article → (7) Reddit + LinkedIn + Facebook → (8) official UET Taxila outreach. Aim for 8–10 submissions/day, unique copy per site.
