# Analytics & Tracking — UET GPT

_Date: 2026-07-16 · Skills: analytics, analytics-tracking_

## Current State
No analytics installed. Cannot measure organic traffic, AI-referral traffic, or confirm crawl.

## Recommendation: Privacy-first, lightweight
UET GPT is open source + student-facing → use a cookieless analytics tool:
- **Plausible** (open source, GDPR, no cookies) — best fit for the brand.
- Alternative: **UMami** (self-hostable) or **Clarity** (free, Microsoft).

## What to Track
| Metric | Why |
|--------|-----|
| Organic sessions | Confirm SEO is working post-index |
| Referral from AI (chatgpt.com, perplexity.ai, bing.com) | Measure AI-SEO (ai-seo skill) |
| Top landing pages | Which cluster pages rank |
| "UET GPT" branded search | Goal #2 |
| Chat starts / queries | Product engagement |

## Implementation
1. Add Plausible script to `layout.tsx` (or Vercel Analytics — already on Vercel).
2. **Vercel Web Analytics** is the zero-config option (already on Vercel) — enable in dashboard.
3. Filter internal traffic.
4. Monthly DIY AI-visibility check (ChatGPT/Perplexity/Google for "UET Taxila").

## GA4 Note
Google Analytics works but uses cookies; Plausible/Vercel Analytics align better with the privacy-first brand. If GA4 chosen, enable via GTM.

## Next Step
Enable Vercel Web Analytics (fastest) + add to `llms.txt`/README that analytics are privacy-first.
