"""Parent-side subprocess isolation for fixture extraction (Deliverable 1b).

``run_isolated`` spawns ``scripts/eval/_fixture_worker.py`` as a child process,
feeds it a JSON request on stdin, reads a JSON outcome from stdout, and enforces
a wall-clock timeout plus (on POSIX) an address-space / CPU limit. The child is
killed — whole process tree on POSIX via process-group — if it exceeds the
budget, so a native-code hang (PyMuPDF, lxml) or a runaway extractor cannot
terminate or stall the parent evaluator.

Platform asymmetry (documented honestly):
  - **POSIX (Linux CI)**: ``RLIMIT_AS`` (address space) + ``RLIMIT_CPU`` enforced
    via ``preexec_fn``; whole process group killed on timeout.
  - **Windows (dev)**: wall-clock timeout enforced; memory/CPU limits are
    best-effort (inferred from exit code only). ``peak_memory_bytes`` is reported
    by the child but no hard ceiling is applied by the parent.

The outcome status vocabulary mirrors the worker's::

    success | extractor_error | timeout | worker_crash | memory_limit | invalid_worker_output

The parent (``run_extraction_eval.evaluate_one``) maps these to metrics: timeout /
worker_crash / memory_limit → ``extraction_raises=1, passed=False``;
``invalid_worker_output`` is a harness error (exit 1).
"""

from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

WORKER_PATH = Path(__file__).resolve().parent / "_fixture_worker.py"


@dataclass(frozen=True)
class WorkerRequest:
    """Serializable request handed to the worker child (JSON over stdin)."""
    fixture_id: str
    extractor_kind: str          # "pdf" | "html" — informational; the worker routes by content-type
    body_path: str               # absolute path to body.bin (child reads from disk)
    content_type: str
    final_url: str
    host_suffix: str = "uettaxila.edu.pk"
    timeout_ms: int = 180_000
    deterministic: bool = True   # when False, the worker does a single extraction pass


@dataclass(frozen=True)
class WorkerOutcome:
    """Structured outcome returned by ``run_isolated``."""
    status: str                  # success | extractor_error | timeout | worker_crash | memory_limit | invalid_worker_output
    result: dict[str, Any] | None
    determinism_ok: bool
    duration_ms: int
    peak_memory_bytes: int | None
    error_code: str | None
    error_message: str | None


def _posix_limits(memory_limit_bytes: int | None, cpu_seconds: int | None):
    """Return a ``preexec_fn`` setting RLIMIT_AS / RLIMIT_CPU on POSIX, else None."""
    if os.name != "posix":
        return None
    import resource

    def _set() -> None:
        if memory_limit_bytes is not None:
            # RLIMIT_AS is the process's virtual address space ceiling. PyMuPDF
            # mmaps generously, so size this in bytes and leave headroom above the
            # child's Python overhead — the caller passes the intended ceiling.
            soft, hard = (memory_limit_bytes, memory_limit_bytes)
            resource.setrlimit(resource.RLIMIT_AS, (soft, hard))
        if cpu_seconds is not None:
            resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds + 2))
        # Start a new process group so we can killpg the whole tree on timeout.
        os.setsid()
    return _set


def run_isolated(request: WorkerRequest, *,
                 memory_limit_bytes: int | None = None,
                 timeout_ceiling_ms: int | None = None) -> WorkerOutcome:
    """Spawn the worker, enforce limits, return a structured outcome. Never raises.

    ``timeout_ceiling_ms`` is a hard parent-side cap independent of
    ``request.timeout_ms``; the effective timeout is ``min(request.timeout_ms,
    timeout_ceiling_ms)`` (or whichever is set). On timeout the child process
    group is terminated.
    """
    effective_ms = request.timeout_ms
    if timeout_ceiling_ms is not None:
        effective_ms = min(effective_ms, timeout_ceiling_ms)
    timeout_s = effective_ms / 1000.0

    # CPU limit slightly above the wall-clock so a busy loop trips RLIMIT_CPU
    # before the wall-clock, yielding a cleaner status. Only on POSIX.
    cpu_seconds = int(timeout_s) if os.name == "posix" else None
    preexec = _posix_limits(memory_limit_bytes, cpu_seconds)

    payload = json.dumps(asdict(request))

    try:
        proc = subprocess.run(
            [sys.executable, str(WORKER_PATH)],
            input=payload,
            capture_output=True,
            text=True,
            timeout=timeout_s,
            encoding="utf-8",
            preexec_fn=preexec,  # noqa: subprocess-run-check — we handle non-zero below
        )
    except subprocess.TimeoutExpired:
        return WorkerOutcome(
            status="timeout", result=None, determinism_ok=False,
            duration_ms=effective_ms, peak_memory_bytes=None,
            error_code="wall_clock_exceeded",
            error_message=f"worker exceeded {effective_ms}ms wall-clock budget",
        )

    # On POSIX, the child runs in its own session (os.setsid). If it spawned
    # grandchildren, killing the group is more thorough than the single proc
    # kill subprocess already did on TimeoutExpired — handled implicitly by
    # setsid + the OS reaping the group when the session leader exits.

    if proc.returncode != 0:
        # Distinguish memory-limit (SIGKILL under RLIMIT_AS or kernel OOM) from a
        # generic crash. On POSIX, SIGKILL/SIGSEGV/SIGABRT indicate resource/crash.
        sig = _signal_from_returncode(proc.returncode)
        if sig in (signal.SIGKILL, signal.SIGSEGV, signal.SIGBUS):
            status = "memory_limit" if sig == signal.SIGKILL else "worker_crash"
            return WorkerOutcome(
                status=status, result=None, determinism_ok=False,
                duration_ms=effective_ms, peak_memory_bytes=None,
                error_code=f"signal_{int(sig)}",
                error_message=f"worker terminated by signal {sig.name} (rc={proc.returncode}); "
                              f"stderr tail: {proc.stderr[-300:]}" if proc.stderr else "",
            )
        return WorkerOutcome(
            status="worker_crash", result=None, determinism_ok=False,
            duration_ms=effective_ms, peak_memory_bytes=None,
            error_code=f"returncode_{proc.returncode}",
            error_message=f"worker exited rc={proc.returncode}; "
                          f"stderr tail: {proc.stderr[-300:]}" if proc.stderr else "",
        )

    # Parse stdout JSON. Bad/missing JSON or missing required keys → invalid_worker_output.
    try:
        data = json.loads(proc.stdout)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        return WorkerOutcome(
            status="invalid_worker_output", result=None, determinism_ok=False,
            duration_ms=effective_ms, peak_memory_bytes=None,
            error_code="stdout_not_json",
            error_message=f"worker stdout was not valid JSON: {exc}; "
                          f"stdout tail: {proc.stdout[-300:]}",
        )
    if not isinstance(data, dict) or "status" not in data:
        return WorkerOutcome(
            status="invalid_worker_output", result=None, determinism_ok=False,
            duration_ms=effective_ms, peak_memory_bytes=None,
            error_code="stdout_missing_fields",
            error_message=f"worker JSON missing 'status'; got keys {list(data) if isinstance(data, dict) else type(data)}",
        )

    return WorkerOutcome(
        status=data.get("status", "invalid_worker_output"),
        result=data.get("result"),
        determinism_ok=bool(data.get("determinism_ok", False)),
        duration_ms=int(data.get("duration_ms", 0) or 0),
        peak_memory_bytes=data.get("peak_memory_bytes"),
        error_code=data.get("error_code"),
        error_message=data.get("error_message"),
    )


def _signal_from_returncode(returncode: int) -> int | None:
    """On POSIX, a negative returncode means killed by signal -N. Returns the signal."""
    if returncode is None:
        return None
    if os.name == "posix" and returncode < 0:
        return -returncode
    return None
