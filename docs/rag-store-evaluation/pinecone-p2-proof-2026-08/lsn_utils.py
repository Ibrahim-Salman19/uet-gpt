#!/usr/bin/env python3
"""LSN-based write-visibility verification (mandate §54): Pinecone serverless
is eventually consistent. `time.sleep(N)` and hope is not a verification
strategy - Pinecone's documented mechanism is the x-pinecone-request-lsn
(on writes) / x-pinecone-max-indexed-lsn (on queries) header pair: a write
is visible once a query's max-indexed-lsn >= the write's request-lsn.

The installed SDK (pinecone 9.1.0) exposes `response.response_info` with
`.raw_headers` containing both of these correctly - VERIFIED by direct
inspection of a real upsert/query round-trip against the live index (not
assumed from docs). However this SDK version's own computed convenience
properties (`.lsn_committed`, `.lsn_reconciled`, `.is_reconciled()`) are
BUGGY: they return None/False even when the underlying raw_headers clearly
carry a valid LSN. Confirmed reproducible: a real upsert returned
raw_headers={'x-pinecone-request-lsn': '2', ...} while `.lsn_committed`
returned None; a subsequent query returned
raw_headers={'x-pinecone-max-indexed-lsn': '3', ...} (which is >= 2, i.e.
genuinely reconciled) while `.is_reconciled(2)` incorrectly returned False.

Per mandate §54's own fallback clause ("If SDK abstractions do not expose
the required headers, use the supported Database API path narrowly for
this verification") this reads raw_headers directly rather than trusting
the SDK's broken convenience properties - the headers themselves are
correct, only the SDK's derived properties are not."""
import time


def _lsn_from_headers(response_info, header_name):
    if response_info is None or response_info.raw_headers is None:
        return None
    value = response_info.raw_headers.get(header_name)
    return int(value) if value is not None else None


def write_lsn(upsert_or_delete_response):
    """The LSN assigned to a write (upsert/delete) operation, read directly
    from the x-pinecone-request-lsn response header."""
    return _lsn_from_headers(getattr(upsert_or_delete_response, "response_info", None), "x-pinecone-request-lsn")


def max_indexed_lsn(query_response):
    """The highest LSN reflected in a query's results so far, read directly
    from the x-pinecone-max-indexed-lsn response header."""
    return _lsn_from_headers(getattr(query_response, "response_info", None), "x-pinecone-max-indexed-lsn")


def wait_for_write_visibility(index, namespace, target_lsn, timeout_s=30.0, poll_interval_s=0.5):
    """Poll `namespace` with a cheap query until its max-indexed-lsn >=
    target_lsn (the LSN of the write being verified). Raises TimeoutError
    rather than silently returning False, so a caller can't accidentally
    treat "gave up polling" as "confirmed invisible" - those are different
    facts."""
    deadline = time.monotonic() + timeout_s
    poll_vector = [0.0] * 768
    attempts = 0
    last_seen = None
    while time.monotonic() < deadline:
        attempts += 1
        resp = index.query(namespace=namespace, vector=poll_vector, top_k=1)
        last_seen = max_indexed_lsn(resp)
        if last_seen is not None and last_seen >= target_lsn:
            return {"reconciled": True, "attempts": attempts, "max_indexed_lsn": last_seen}
        time.sleep(poll_interval_s)
    raise TimeoutError(
        f"namespace {namespace!r} did not reconcile to LSN {target_lsn} within {timeout_s}s "
        f"({attempts} polls, last max_indexed_lsn={last_seen})"
    )


def delete_and_wait_gone(index, namespace, delete_fn, verify_query_kwargs, timeout_s=30.0, poll_interval_s=0.5):
    """Pinecone's classic vector delete() (by id or by metadata filter)
    returns no response body at all in this SDK - confirmed by direct
    inspection (`index.delete(filter=...)` returns `None`, not even an
    object with empty headers), unlike upsert/query which both reliably
    carry response_info. There is therefore no LSN to target for a delete
    specifically. Falls back to polling the same query a caller would use
    to check the delete's effect, until it returns zero matches - still a
    bounded, verified wait (mandate §60), just keyed on the observable
    effect rather than an LSN this API doesn't expose for this operation.

    `delete_fn` is called with no arguments (a closure over the actual
    delete() call, so callers control the exact filter/ids/namespace).
    `verify_query_kwargs` are passed to index.query() to check whether the
    deleted vectors are still visible (do not include `vector`/`top_k` -
    those are supplied here)."""
    delete_fn()
    deadline = time.monotonic() + timeout_s
    poll_vector = [0.0] * 768
    attempts = 0
    remaining = None
    while time.monotonic() < deadline:
        attempts += 1
        resp = index.query(namespace=namespace, vector=poll_vector, top_k=100, **verify_query_kwargs)
        remaining = len(resp["matches"])
        if remaining == 0:
            return {"gone": True, "attempts": attempts}
        time.sleep(poll_interval_s)
    raise TimeoutError(
        f"namespace {namespace!r} still has {remaining} matching vector(s) after delete, "
        f"{timeout_s}s / {attempts} polls"
    )


def upsert_and_wait(index, namespace, vectors, timeout_s=30.0):
    """Upsert then block until the write is durably queryable. Returns the
    write LSN so callers can chain a second wait_for_write_visibility
    against a later operation if needed (e.g. verifying a delete lands
    after a prior upsert's LSN)."""
    resp = index.upsert(vectors=vectors, namespace=namespace)
    target_lsn = write_lsn(resp)
    if target_lsn is None:
        raise RuntimeError(
            "upsert response carried no x-pinecone-request-lsn header - cannot verify write "
            "visibility deterministically"
        )
    visibility = wait_for_write_visibility(index, namespace, target_lsn, timeout_s=timeout_s)
    return {"upserted_count": resp.upserted_count, "lsn_committed": target_lsn, **visibility}
