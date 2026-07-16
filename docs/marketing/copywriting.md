# Copywriting — UET GPT

_Date: 2026-07-16 · Skill: copywriting_

## Principle
Copy must serve humans AND be extractable by AI (40-60 word answer blocks, direct leads, no fluff). Keep it specific, with real numbers.

## Homepage Hero (current → proposed)
**Current H1:** "UET GPT"
**Proposed H1:** "UET GPT — Your AI Guide to UET Taxila"

**Current sub:** generic
**Proposed sub (under 60 words, extractable):**
> UET GPT is a free, open-source AI assistant that answers any question about the University of Engineering and Technology, Taxila — admissions, ECAT, merit calculation, fee structure, departments, and campus life — using official university data, not generic web guesses.

**Primary CTA:** "Ask UET GPT" → `/chat`
**Secondary CTA:** "Explore UET Taxila" → `/uet-taxila`

## Value Proposition Block (for /uet-gpt)
**Headline:** "The only AI built on official UET Taxila data"
**Bullets (specific, not vague):**
- Answers grounded in the official UET Taxila prospectus and website
- Free and open source (AGPL-3.0) — inspect or self-host the code
- Every answer cites its source
- Covers admissions, fees, 14 departments, and campus life

## Comparison Page Hook (template)
**Headline:** "UET Taxila vs [Competitor]: which fits you?"
**Lead (extractable):** "UET Taxila is a public, HEC-recognized engineering university ~35 km from Islamabad with subsidized tuition; [Competitor] differs in [fee / entry test / ranking]. Here's the full breakdown."

## Social Proof (add when available)
- "Used by 5,000+ UET Taxila students" (once true / measurable)
- "Powered by RAG over official UET documents"

## Anti-patterns to avoid
- No em dashes in published web copy (brand guideline, matches dev.to draft).
- No "blazing fast" / "best in class" vague claims — use specifics.
- No keyword stuffing (hurts AI visibility -10%).

## Next step
Apply proposed hero/sub to `src/app/page.tsx` and `src/app/uet-gpt/page.tsx` (design review pass recommended before merge).
