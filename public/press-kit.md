# UET GPT - Press Kit

*Your AI Guide to UET Taxila.*

UET GPT is an open-source AI chatbot that answers any question about the University of Engineering and Technology (UET), Taxila - admissions, fee structure, academic programs, departments, faculty, campus life, transport, hostels, scholarships, and more - using RAG-powered retrieval from official UET Taxila documents and web pages.

This page is a public, crawlable resource for journalists, bloggers, educators, and directory sites. Link to it, cite it, or copy the boilerplate below.

---

## What is UET GPT?

UET GPT is a specialized AI assistant for the University of Engineering and Technology (UET) Taxila, one of Pakistan's premier engineering institutions. It lets students, applicants, parents, and faculty ask questions in plain language and receive fast, accurate, citation-backed answers drawn from UET Taxila's official website (`web.uettaxila.edu.pk`), admissions portal (`admissions.uettaxila.edu.pk`), and ingested university documents.

Rather than searching through scattered pages and PDFs, users get grounded answers built on a continuously crawled, indexed knowledge base - not generic model guesses.

## Key Features

- **RAG-Powered Answers** - Retrieves information from official UET Taxila documents and web pages.
- **Real-Time Indexing** - Continuously crawls and indexes UET Taxila's official website and admissions portal.
- **Multi-Model AI** - Routes across models (e.g., Llama 4 Scout for deep reasoning, Llama 3.1 8B for fast responses) with a fallback chain.
- **Citation Engine** - Every answer includes source references from official university materials.
- **Privacy-First** - Clerk-powered authentication with user-controlled data export and deletion.
- **Open Source** - The full codebase is public on GitHub and free to use.

## Who is it for?

- **UET Taxila students** - quick answers on fees, exams, transport, hostels, scholarships, and campus life.
- **Prospective students & applicants** - admissions procedure, requirements, schedules, seat allocation, and merit lists.
- **Parents & guardians** - clear, sourced information about programs and processes.
- **Faculty & staff** - fast lookups across departments and official resources.

## Technology Stack

- **Frontend:** Next.js, React, Tailwind CSS
- **Backend:** Convex (real-time database + serverless functions, native vector index)
- **Auth:** Clerk (RBAC: user / admin / superadmin)
- **LLM:** Vercel AI SDK with a multi-provider fallback chain
- **Vector Search:** Convex vector indexes with Gemini embeddings
- **Crawler:** Python async BFS crawler (`curl_cffi`, `trafilatura`)
- **Deployment:** Vercel

## Links

- **Live app:** https://uet-gpt.vercel.app
- **Chat:** https://uet-gpt.vercel.app/chat
- **GitHub (source):** https://github.com/devhms/uet_gpt
- **About UET Taxila:** https://uet-gpt.vercel.app/about
- **Press kit:** https://uet-gpt.vercel.app/press-kit.md

## About UET Taxila

The University of Engineering and Technology (UET) Taxila is one of Pakistan's premier engineering institutions, offering undergraduate and graduate programs across engineering, technology, and computer science disciplines. Founded in 1975 (as a campus of UET Lahore, gaining an independent charter in 1993), it serves over 5,000 students across 30+ programs.

## Copy-Ready Boilerplate

*Feel free to copy and publish the paragraph below:*

> UET GPT is an open-source AI chatbot that acts as an intelligent guide to the University of Engineering and Technology (UET) Taxila in Pakistan. Built on Retrieval-Augmented Generation over official university data, it answers questions about admissions, fee structures, academic programs, departments, faculty, campus life, transport, hostels, and scholarships - with citations back to official UET Taxila sources. It is free to use at https://uet-gpt.vercel.app and open source at https://github.com/devhms/uet_gpt.

## One-Line Description

`UET GPT - an open-source AI chatbot that answers any question about UET Taxila, grounded in official university data.`

---

*UET GPT is an independent, open-source project and is not an official publication of the University of Engineering and Technology, Taxila.*
