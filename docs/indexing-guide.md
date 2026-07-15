# Google & Bing Indexing Guide

The sitemap is live at `https://uet-gpt.vercel.app/sitemap.xml` and has been deployed. Search engines will crawl it automatically within 1–4 weeks. To accelerate indexing, request it manually.

## Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property → enter `https://uet-gpt.vercel.app`
3. Verify via HTML tag or DNS TXT record
4. Once verified, go to **URL Inspection** and request indexing for each URL:

| URL | Priority |
|-----|----------|
| `https://uet-gpt.vercel.app` | Highest |
| `https://uet-gpt.vercel.app/uet-taxila` | High |
| `https://uet-gpt.vercel.app/uet-gpt` | High |
| `https://uet-gpt.vercel.app/uet-taxila/admissions` | Medium |
| `https://uet-gpt.vercel.app/uet-taxila/programs` | Medium |
| `https://uet-gpt.vercel.app/uet-taxila/fee-structure` | Medium |

Also submit `https://uet-gpt.vercel.app/sitemap.xml` under **Sitemaps**.

## Bing Webmaster Tools

1. Go to [Bing Webmaster Tools](https://www.bing.com/webmasters)
2. Add site → enter `https://uet-gpt.vercel.app`
3. Verify via meta tag or DNS
4. Submit `https://uet-gpt.vercel.app/sitemap.xml`
5. Use **URL Submission** to request indexing for each URL above

Bing also supports **IndexNow** — if you have an IndexNow API key, ping:
```
POST https://api.indexnow.org/IndexNow
{
  "host": "uet-gpt.vercel.app",
  "key": "YOUR_INDEXNOW_KEY",
  "keyLocation": "https://uet-gpt.vercel.app/YOUR_INDEXNOW_KEY.txt",
  "urlList": [
    "https://uet-gpt.vercel.app",
    "https://uet-gpt.vercel.app/uet-taxila",
    "https://uet-gpt.vercel.app/uet-gpt",
    "https://uet-gpt.vercel.app/uet-taxila/admissions",
    "https://uet-gpt.vercel.app/uet-taxila/programs",
    "https://uet-gpt.vercel.app/uet-taxila/fee-structure"
  ]
}
```

## Expected Timeline

- **Google**: 3–14 days after manual request (can be instant for high-quality pages)
- **Bing**: 1–3 days after submission
- **Automatic crawl**: 1–4 weeks via sitemap alone
