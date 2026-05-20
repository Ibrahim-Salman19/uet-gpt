# Chunking Strategy

## Approach

- **Method:** Recursive character text splitter
- **Chunk size:** 1000 tokens
- **Overlap:** 200 tokens (20%)
- **Unit:** Token-aware (tiktoken `cl100k_base`)

## Rationale

- Balances context preservation with retrieval precision
- Overlap prevents boundary truncation of key information
- Embedding dimension: 768 (matching Gemini `text-embedding-004`)

## TODO

- [ ] Implement chunking in Convex action (or separate worker)
- [ ] Add metadata tagging per chunk (source URL, heading, section)
- [ ] Handle special content types (tables, lists, code blocks)
