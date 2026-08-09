"""UET evaluation tooling.

- ``run_eval``               : retrieval-quality eval (recall@k/MRR/nDCG vs Convex).
- ``run_extraction_eval``    : extraction-quality eval (title/block/link precision/recall vs fixtures).
- ``extraction_metrics``     : pure matchers/normalization used by the extraction eval.
- ``generate_golden``        : builds the retrieval golden set.
"""
