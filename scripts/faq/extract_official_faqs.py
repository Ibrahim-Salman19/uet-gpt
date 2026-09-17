#!/usr/bin/env python3
"""Rebuild scripts/faq/official-faqs.json from the crawled markdown of the two official
UET FAQ pages, so the FAQ retrieval channel (convex/embeddings/search.ts) can be refreshed
after a re-crawl without hand-editing JSON.

    python3 scripts/faq/extract_official_faqs.py [--documents <documents.jsonl>]

Source: the crawl export's documents.jsonl (one JSON object per document, with `canonicalUrl`
and `markdown`). Answers are copied verbatim; only whitespace is collapsed.

ALIASES add extra question wordings for an answer that already covers them. The gate in
convex/shared/faqMatch.ts compares the asked question with the FAQ's question wording, so a
student asking "minimum percentage required in FSc" does not match "eligibility criteria"
even though that FAQ states the percentages.
"""

import argparse
import json
import re

FAQS_PHP = "/faqs.php"
EXAMS_FAQ = "/examsfaq.aspx"
DEFAULT_DOCUMENTS = "/mnt/d/uetgpt_corpus_v1/documents.jsonl"

# question the page asks -> extra wordings that the same answer genuinely answers
ALIASES = {
    "What are the eligibility criteria for admission?": [
        "What is the minimum percentage required in FSc for admission?",
        "What percentage of marks is required in FSc, ICS or DAE to be eligible?",
    ],
}


def extract(markdown: str, url: str) -> list[dict]:
    if url.lower().endswith(FAQS_PHP):
        pattern = r"\n##\s+([^\n]+\?)\n+(.*?)(?=\n#{2,5}\s|\Z)"
    elif url.lower().endswith(EXAMS_FAQ):
        pattern = r"\n-\s+\[([^\]]+\?)\]\(<#questionul>\)\n-\s+(.*?)(?=\n-\s+\[|\Z)"
    else:
        return []

    out = []
    for match in re.finditer(pattern, markdown, re.S):
        question = match.group(1).strip()
        answer = re.sub(r"\s*\n\s*", " ", match.group(2).strip())
        if len(answer) <= 20:
            continue
        out.append({"question": question, "answer": answer, "sourceUrl": url})
        for alias in ALIASES.get(question, []):
            out.append({"question": alias, "answer": answer, "sourceUrl": url})
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--documents", default=DEFAULT_DOCUMENTS)
    args = parser.parse_args()

    faqs: list[dict] = []
    with open(args.documents) as handle:
        for line in handle:
            doc = json.loads(line)
            faqs.extend(extract(doc.get("markdown", ""), doc.get("canonicalUrl", "")))

    with open("scripts/faq/official-faqs.json", "w") as handle:
        json.dump(faqs, handle, indent=1, ensure_ascii=False)
    print(f"{len(faqs)} FAQ entries written to scripts/faq/official-faqs.json")


if __name__ == "__main__":
    main()
