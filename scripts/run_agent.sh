#!/usr/bin/env bash
# =============================================================================
# scripts/run_agent.sh — UET Taxila RAG Pipeline Cron Entry Point
# Platform: Google Antigravity 2.0 (agy CLI)
# =============================================================================
# Cron setup: 0 * * * * /path/to/scripts/run_agent.sh >> logs/cron.log 2>&1
#
# NOTE: Antigravity 2.0 has NATIVE scheduling built in.
# If you're already running the agy desktop app or TUI, you can skip this
# shell script entirely and use native scheduling instead:
#
#   /schedule cron="0 * * * *" prompt="$(cat CRONJOB.md)"
#
# Use this shell script only when:
#   a) Running on a headless server with no desktop app
#   b) You want external cron to control the schedule precisely
#   c) You need the lock file / budget check / branch logic below
# =============================================================================
# Research basis:
#   - agy --help output (official CLI reference)
#   - aimadetools.com headless auth guide (SSH_CONNECTION pattern)
#   - boucle (DEV Community): lock file, state management
#   - long-running-tasks (GitHub): stall detection, timeout handling
#   - SitePoint 13-day methodology: branch isolation, git safety
# =============================================================================
set -euo pipefail

# ─── Paths ───────────────────────────────────────────────────────────────────
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DATE_STR=$(date +%Y-%m-%d)
LOG_FILE="logs/cron.log"
LOCK_FILE=".agent/run.lock"
AGENT_BRANCH="agent/${DATE_STR}"

# ─── agy CLI timeout ──────────────────────────────────────────────────────────
# agy default --print-timeout is 5m0s — FAR too short for a pipeline maintenance
# task. Set to 50 minutes: leaves 10-minute buffer before next hourly tick.
# The hard outer shell timeout (55 min) catches hung agy processes.
AGY_PRINT_TIMEOUT="50m"
SHELL_TIMEOUT_SECONDS=3300   # 55 minutes = hard kill timeout

# ─── Setup ───────────────────────────────────────────────────────────────────
mkdir -p logs .agent

echo ""
echo "══════════════════════════════════════════════════════════════"
echo " UET TAXILA RAG AGENT (agy) | START | ${TIMESTAMP}"
echo "══════════════════════════════════════════════════════════════"

# ─── Verify agy is installed ─────────────────────────────────────────────────
if ! command -v agy &> /dev/null; then
  echo "ERROR: agy CLI not found. Install with:"
  echo "  curl -fsSL https://antigravity.google/cli/install.sh | bash"
  echo "  source ~/.zshrc  # or ~/.bashrc"
  exit 1
fi
echo "agy version: $(agy --version 2>/dev/null || echo 'unknown')"

# ─── Lock file: prevent overlapping runs ─────────────────────────────────────
if [ -f "$LOCK_FILE" ]; then
  LOCK_CONTENT=$(cat "$LOCK_FILE" 2>/dev/null || echo "0:unknown")
  LOCK_PID=$(echo "$LOCK_CONTENT" | cut -d: -f1)
  LOCK_TIME_STR=$(echo "$LOCK_CONTENT" | cut -d: -f2)
  LOCK_EPOCH=$(date -d "$LOCK_TIME_STR" +%s 2>/dev/null || echo 0)
  NOW_EPOCH=$(date +%s)
  LOCK_AGE=$(( NOW_EPOCH - LOCK_EPOCH ))

  # Fresh lock + process still alive → skip this run
  if [ "$LOCK_AGE" -lt 7200 ] && kill -0 "$LOCK_PID" 2>/dev/null; then
    echo "SKIP: Run in progress (PID $LOCK_PID, ${LOCK_AGE}s old). Exiting cleanly."
    exit 0
  elif [ "$LOCK_AGE" -lt 7200 ]; then
    # Lock is fresh but process is dead → previous run crashed
    echo "WARN: Stale lock (PID $LOCK_PID dead, ${LOCK_AGE}s). Previous run crashed."
    echo "crashed:${LOCK_PID},at:${LOCK_TIME_STR}" >> .agent/incident_log.md
  else
    echo "INFO: Old lock (${LOCK_AGE}s). Clearing."
  fi
  rm -f "$LOCK_FILE"
fi

# Write new lock: PID:ISO8601
echo "$$:${TIMESTAMP}" > "$LOCK_FILE"

# Ensure lock is ALWAYS removed on any exit (normal, error, timeout signal)
cleanup() {
  local code=$?
  rm -f "$LOCK_FILE"
  echo "EXIT: $(date -u +%Y-%m-%dT%H:%M:%SZ) | code=${code}"
  echo "──────────────────────────────────────────────────────────────"
  exit "$code"
}
trap cleanup EXIT INT TERM

# ─── Branch safety ───────────────────────────────────────────────────────────
# agy agent NEVER commits to main/master
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
  git checkout -b "$AGENT_BRANCH" 2>/dev/null || git checkout "$AGENT_BRANCH"
  echo "INFO: Switched to agent branch: $AGENT_BRANCH"
fi

# ─── Budget check ────────────────────────────────────────────────────────────
RUNS_TODAY=$(grep -c "${DATE_STR}" .agent/progress_log.md 2>/dev/null || echo 0)
echo "INFO: Runs today: ${RUNS_TODAY}"

# ─── Headless auth check ─────────────────────────────────────────────────────
# agy needs a valid credential to run non-interactively.
# Token is cached at ~/.config/agy/credentials.json after first browser auth.
# For CI/cron: run `agy auth login` once manually on the server, or
# set SSH_CONNECTION to force URL-based auth flow.
if [ ! -f "$HOME/.config/agy/credentials.json" ]; then
  echo "ERROR: No agy credentials found at ~/.config/agy/credentials.json"
  echo "Run once on this server: export SSH_CONNECTION='127.0.0.1 0 127.0.0.1 0' && agy auth login"
  echo "Then authenticate via the URL printed to terminal."
  exit 1
fi

# ─── Build the prompt ────────────────────────────────────────────────────────
# Lightweight mode (> 20 runs today): eval only, no code changes
if [ "$RUNS_TODAY" -gt 20 ]; then
  echo "INFO: Budget limit. Lightweight mode (eval + document only)."
  PROMPT_PREFIX="LIGHTWEIGHT MODE: You are over daily budget. Run ONLY the eval
harness (scripts/eval/run_eval.py), record results in .agent/state.md, and exit.
Make zero code changes. Zero commits. Document findings only.

"
else
  PROMPT_PREFIX=""
fi

# ─── Run agy non-interactively ───────────────────────────────────────────────
# Key flags:
#   -p / --print         → non-interactive mode, print output and exit
#   --print-timeout 50m  → CRITICAL: overrides the default 5m0s timeout
#   --dangerously-skip-permissions → auto-approve all tool calls for automation
#
# The /goal prefix inside the prompt is the Antigravity 2.0 native mechanism
# for autonomous execution — it tells the agent to run to completion without
# pausing for confirmation. It is not a shell flag; it's a slash command in
# the prompt content itself (from antigravity.google/blog/io-2026-feature-deep-dive)

echo ""
echo "INFO: Launching agy agent (print-timeout: ${AGY_PRINT_TIMEOUT})...."
echo ""

timeout "$SHELL_TIMEOUT_SECONDS" agy \
  --print \
  --print-timeout "$AGY_PRINT_TIMEOUT" \
  --dangerously-skip-permissions \
  -p "${PROMPT_PREFIX}$(cat CRONJOB.md)

## RUNTIME CONTEXT (injected by run_agent.sh)
current_timestamp_utc: ${TIMESTAMP}
git_branch: $(git branch --show-current 2>/dev/null || echo unknown)
runs_today: ${RUNS_TODAY}
uncommitted_files: $(git status --short 2>/dev/null | wc -l)
dlq_size: $(wc -l < scripts/dlq.jsonl 2>/dev/null || echo 0)
" \
  2>&1 | tee -a "$LOG_FILE"

AGY_EXIT=${PIPESTATUS[0]}

# ─── Exit handling ────────────────────────────────────────────────────────────
if [ "$AGY_EXIT" -eq 124 ]; then
  echo ""
  echo "TIMEOUT: agy hit ${SHELL_TIMEOUT_SECONDS}s shell timeout."
  echo "Work committed during the run is preserved. Check git log."
  echo "shell_timeout:${TIMESTAMP}" >> .agent/incident_log.md
  exit 0
fi

if [ "$AGY_EXIT" -ne 0 ]; then
  echo ""
  echo "ERROR: agy exited with code ${AGY_EXIT}"
  echo "agy_error:${AGY_EXIT},timestamp:${TIMESTAMP}" >> .agent/incident_log.md
  exit "$AGY_EXIT"
fi

echo "INFO: agy completed normally."
# Lock cleanup handled by trap
