# Wikidata Entity Draft — "UET GPT"

> Ready-to-submit draft for a new Wikidata item about **UET GPT**, the open-source AI chatbot that is the intelligent guide to the University of Engineering and Technology (UET), Taxila, Pakistan.

## 1. Entity Summary

| Field | Value |
|-------|-------|
| **Label (en)** | UET GPT |
| **Description (en)** | Open-source AI chatbot that serves as an intelligent guide to the University of Engineering and Technology, Taxila, Pakistan |
| **Aliases (en)** | UET Taxila GPT, UET-GPT, UET GPT chatbot |
| **Instance of** | chatbot (Q844614), virtual assistant (Q11028), software (Q7397) |
| **Official website** | https://uet-gpt.vercel.app |
| **Described by source** | https://github.com/devhms/uet_gpt (GitHub repository) |
| **Developer / author** | devhms |
| **License** | Undeclared — the repository currently ships no LICENSE file and no `license` field in package.json. The README describes it as released "under an open license," but a specific SPDX identifier (e.g., MIT, Apache-2.0) is not yet stated. Do NOT assert a specific license on Wikidata until one is formally added to the repo. |
| **Programming language** | TypeScript (frontend/backend), Python (crawler) |
| **Official website (P856)** | https://uet-gpt.vercel.app |

## 2. Statement List (Wikidata property IDs)

Use these property IDs when creating statements on the item:

- **P31 (instance of)**:
  - `Q844614` — chatbot
  - `Q11028` — virtual assistant
  - `Q7397` — software
- **P856 (official website)**: `https://uet-gpt.vercel.app`
- **P837 (described by source)**: `https://github.com/devhms/uet_gpt`
- **P178 (developer)**: `devhms`
- **P277 (programming language)**: `Q200686` (TypeScript), `Q28865` (Python)
- **P159 (headquarters location)** *(optional)*: Taxila, Punjab, Pakistan
- **P17 (country)**: `Q843` (Pakistan) *(optional)*

> Note on **license (P275)**: Leave this statement **unset** until the repository adds a real LICENSE file. Asserting an incorrect license violates Wikidata's "no original research" policy.

## 3. References (cited sources)

Every statement should carry at least one reference. Suggested references:

1. **GitHub repository** — https://github.com/devhms/uet_gpt
   - Supports: instance of (software), developer (devhms), described by source, programming language, official code source.
2. **Live website** — https://uet-gpt.vercel.app
   - Supports: official website, that it is an operational AI chatbot for UET Taxila.
3. **README / project description** — https://github.com/devhms/uet_gpt#readme
   - Supports: open-source status and purpose (AI guide to UET Taxila).

> **Notability requirement:** Wikidata requires that a new item be *notable* — verifiable through independent, reliable published sources. The two first-party references above (GitHub repo + own website) are **not sufficient by themselves**. Before creating the item, secure at least one **independent third-party** reference (e.g., a news article, a university page mentioning UET GPT, a directory listing, or a blog post) that discusses UET GPT. See the Wikipedia section below for how to build toward that.

## 4. Step-by-Step: Create the Wikidata Item

1. **Confirm notability.** Obtain at least one independent, reliable reference (see above). Without it, the item risks speedy deletion.
2. **Log in** to Wikidata with a registered account (accounts must be a few days old with a small edit count before creating items).
3. Go to **https://www.wikidata.org/wiki/Special:NewItem**.
4. Fill in:
   - **Label**: `UET GPT`
   - **Description**: `Open-source AI chatbot that serves as an intelligent guide to the University of Engineering and Technology, Taxila, Pakistan`
   - **Aliases**: `UET Taxila GPT`, `UET-GPT`, `UET GPT chatbot`
5. Click **Create**. You will land on the new item's page (e.g., `Q########`).
6. Click **add statement** and add:
   - `instance of` → `chatbot` (and optionally `virtual assistant`, `software`).
   - `official website` → `https://uet-gpt.vercel.app`.
   - `described by source` → `https://github.com/devhms/uet_gpt`.
   - `developer` → `devhms`.
   - `programming language` → `TypeScript`, `Python`.
7. For each statement, click the **reference** icon and add the supporting URL(s) from Section 3 (use the "reference URL" property `P854`).
8. **Add an English Wikipedia article link** only if a corresponding Wikipedia article exists (see Section 5).
9. **Save**. Monitor the item for the first 48 hours in case a notability patroller flags it; be ready to add the independent reference.

## 5. Getting UET GPT Mentioned on English Wikipedia

There is an existing English Wikipedia article: **"University of Engineering and Technology, Taxila"** — https://en.wikipedia.org/wiki/University_of_Engineering_and_Technology,_Taxila

To propose a mention of UET GPT there:

1. **Don't create a standalone article yet.** A standalone "UET GPT" article would fail the notability guideline (WP:GNG) without significant independent coverage. Instead, suggest a brief, sourced mention within the existing UET Taxila article.
2. **Open the talk page** — https://en.wikipedia.org/wiki/Talk:University_of_Engineering_and_Technology,_Taxila — and propose adding a sentence in a "Student resources" or "Technology" section, e.g.:
   > *"The university community also uses UET GPT, an open-source AI chatbot that answers questions about admissions, programs, and campus life using official UET Taxila data."*
3. **Cite an independent source.** The sentence must be backed by a reliable, independent reference (not just the GitHub repo or the project site). Options:
   - A university newsletter or official UET Taxila page that references the tool.
   - A third-party news or tech blog article.
   - A directory/roundup listing UET GPT.
4. **Use the edit request process** if you lack the edit rights to edit the article directly (new accounts are often restricted from direct article edits). Post the proposed wording + citation on the talk page as an "edit request."
5. **Once an independent source exists and the Wikipedia mention is live**, that Wikipedia article itself becomes a strong, independent Wikidata reference — satisfying the notability requirement from Section 3, and you can then safely create the Wikidata item with `described by source` pointing to both GitHub and the Wikipedia article.

> Ethical note: Never add promotional, unsourced, or self-referential content to Wikipedia. Keep any mention neutral, factual, and properly cited.
