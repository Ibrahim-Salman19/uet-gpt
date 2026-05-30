#!/usr/bin/env bash
# =============================================================================
# scripts/run_agent.sh — UET Taxila RAG Pipeline Cron Entry Point
# Platform: Google Antigravity 2.0 (agy CLI)
# =============================================================================
# Cron setup: 0 * * * * /absolute/path/to/scripts/run_agent.sh >> logs/cron.log 2>&1
#
# NOTE: Antigravity 2.0 has NATIVE scheduling built in.
# If you're already inside the agy TUI, skip this script and use:
#   /schedule cron="0 * * * *" prompt="$(cat CRONJOB.md)"
#
# Use this script when:
#   a) Running on a headless server with no desktop app
#   b) You want the lock file / budget / retry logic below
# =============================================================================
set -uo pipefail
# NOTE: We intentionally do NOT use -e here.
# Several commands (grep -c, git diff --quiet) legitimately exit 1 to signal
# "no matches" or "files differ". Using -e would abort the script on those.

# ─── Normalize PATH for cron (cron has a minimal, stripped environment) ───────
export PATH="/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:$HOME/.local/bin:$HOME/bin:$PATH"

# Add common tool locations
[ -d "$HOME/.nvm/versions/node" ] && \
  export PATH="$(ls -d $HOME/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1):$PATH"
[ -d "$HOME/.pyenv/shims" ] && export PATH="$HOME/.pyenv/shims:$PATH"
[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env" 2>/dev/null || true

# ─── Paths ───────────────────────────────────────────────────────────────────
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DATE_STR=$(date +%Y-%m-%d)
LOG_FILE="logs/cron.log"
LOCK_FILE=".agent/run.lock"
AGENT_BRANCH="agent/${DATE_STR}"

# ─── agy timeouts ────────────────────────────────────────────────────────────
# agy default --print-timeout is 5m0s — far too short.
# 50 min gives the agent real working time; 55 min shell timeout is the hard kill.
AGY_PRINT_TIMEOUT="50m"
SHELL_TIMEOUT_SECONDS=3300   # 55 minutes

# ─── Setup ───────────────────────────────────────────────────────────────────
mkdir -p logs .agent

# ─── Log rotation: keep last 50 000 lines to prevent disk exhaustion ─────────
if [ -f "$LOG_FILE" ] && [ "$(wc -l < "$LOG_FILE")" -gt 50000 ]; then
  echo "INFO: Rotating log (>50k lines)"
  tail -20000 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo " UET TAXILA RAG AGENT (agy) | START | ${TIMESTAMP}"
echo "══════════════════════════════════════════════════════════════"

# ─── Verify agy is installed ─────────────────────────────────────────────────
if ! command -v agy &>/dev/null; then
  echo "ERROR: agy CLI not found. Install with:"
  echo "  curl -fsSL https://antigravity.google/cli/install.sh | bash"
  echo "  Then add to PATH and re-run."
  exit 1
fi
echo "agy version: $(agy --version 2>/dev/null || echo 'unknown')"

# ─── Cross-platform date helper ──────────────────────────────────────────────
# GNU date: date -d "string" +%s   BSD/macOS date: date -j -f "%Y-%m-%dT%H:%M:%SZ" "string" +%s
parse_iso_epoch() {
  local ts="$1"
  # Try GNU date first, then BSD date, then Python fallback
  date -d "$ts" +%s 2>/dev/null || \
  date -j -f "%Y-%m-%dT%H:%M:%SZ" "$ts" +%s 2>/dev/null || \
  python3 -c "from datetime import datetime, timezone; print(int(datetime.fromisoformat('${ts}'.replace('Z','+00:00')).timestamp()))" 2>/dev/null || \
  echo 0
}

# ─── Lock file: prevent overlapping runs ─────────────────────────────────────
if [ -f "$LOCK_FILE" ]; then
  LOCK_CONTENT=$(cat "$LOCK_FILE" 2>/dev/null || echo "0:1970-01-01T00:00:00Z")
  LOCK_PID=$(echo "$LOCK_CONTENT"  | cut -d: -f1)
  LOCK_TIME_STR=$(echo "$LOCK_CONTENT" | cut -d: -f2-)
  LOCK_EPOCH=$(parse_iso_epoch "$LOCK_TIME_STR")
  NOW_EPOCH=$(date +%s)
  LOCK_AGE=$(( NOW_EPOCH - LOCK_EPOCH ))

  # PID is still alive AND lock is fresh → a real concurrent run is active
  if [ "$LOCK_AGE" -lt 7200 ] && kill -0 "$LOCK_PID" 2>/dev/null; then
    # Extra guard: also verify the PID is our script (not a recycled PID)
    LOCK_CMD=$(ps -p "$LOCK_PID" -o comm= 2>/dev/null || echo "")
    if echo "$LOCK_CMD" | grep -qiE "bash|sh|agy"; then
      echo "SKIP: Run in progress (PID $LOCK_PID, ${LOCK_AGE}s old). Exiting cleanly."
      exit 0
    fi
  fi

  if [ "$LOCK_AGE" -lt 7200 ]; then
    echo "WARN: Fresh lock (PID $LOCK_PID dead/recycled, ${LOCK_AGE}s). Previous run crashed."
    printf '{"event":"crash_recovery","pid":%s,"at":"%s","detected":"%s"}\n' \
      "$LOCK_PID" "$LOCK_TIME_STR" "$TIMESTAMP" >> .agent/incident_log.md
  else
    echo "INFO: Old lock (${LOCK_AGE}s). Clearing."
  fi
  rm -f "$LOCK_FILE"
fi

# Write new lock: PID:ISO8601
echo "${$}:${TIMESTAMP}" > "$LOCK_FILE"

# Ensure lock is ALWAYS released on any exit (normal, error, SIGTERM, timeout)
cleanup() {
  local code=$?
  rm -f "$LOCK_FILE"
  echo "EXIT: $(date -u +%Y-%m-%dT%H:%M:%SZ) | code=${code}"
  echo "──────────────────────────────────────────────────────────────"
}
trap cleanup EXIT INT TERM

# ─── Branch safety ───────────────────────────────────────────────────────────
# Never commit to main/master. Use `rev-parse` for older git compatibility (pre-2.22).
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
  git checkout -b "$AGENT_BRANCH" 2>/dev/null || git checkout "$AGENT_BRANCH"
  echo "INFO: Switched to agent branch: $AGENT_BRANCH"
fi

# ─── Budget check ────────────────────────────────────────────────────────────
# Use `|| true` to prevent -uo pipefail from aborting when grep finds 0 matches.
RUNS_TODAY=$(grep -c "${DATE_STR}" .agent/progress_log.md 2>/dev/null || true)
RUNS_TODAY=${RUNS_TODAY:-0}
echo "INFO: Runs today: ${RUNS_TODAY}"

# ─── Headless auth check ─────────────────────────────────────────────────────
AGY_CRED_FILE="$HOME/.config/agy/credentials.json"
if [ ! -f "$AGY_CRED_FILE" ]; then
  echo "ERROR: No agy credentials found at $AGY_CRED_FILE"
  echo "Run once interactively:"
  echo "  export SSH_CONNECTION='127.0.0.1 0 127.0.0.1 0' && agy auth login"
  exit 1
fi

# ─── Disk space guard ────────────────────────────────────────────────────────
# If less than 500MB free on the project's filesystem, enter eval-only mode.
FREE_KB=$(df -k "$PROJECT_ROOT" 2>/dev/null | awk 'NR==2{print $4}' || echo 999999)
if [ "${FREE_KB:-999999}" -lt 512000 ]; then
  echo "WARN: Low disk space (${FREE_KB}KB free). Lightweight mode forced."
  RUNS_TODAY=99  # Force lightweight mode below
fi

# ─── Build the prompt ────────────────────────────────────────────────────────
if [ "${RUNS_TODAY}" -gt 20 ]; then
  echo "INFO: Budget limit (${RUNS_TODAY} runs today). Lightweight mode (eval + document only)."
  PROMPT_PREFIX="LIGHTWEIGHT MODE: You are over daily budget (${RUNS_TODAY} runs today).
Run ONLY the eval harness:
  python scripts/eval/run_eval.py \\
    --golden scripts/eval/golden_set.jsonl \\
    --output .agent/eval_$(date +%Y%m%d_%H%M).json \\
    --top_k 5

Record results in .agent/state.md. Make zero code changes. Zero commits.
Document findings only. Then exit.

"
else
  PROMPT_PREFIX=""
fi

# ─── Collect runtime context for the agent ───────────────────────────────────
RUNTIME_CONTEXT="
## RUNTIME CONTEXT (injected by run_agent.sh at launch time)
current_timestamp_utc: ${TIMESTAMP}
git_branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)
runs_today: ${RUNS_TODAY}
uncommitted_files: $(git status --short 2>/dev/null | wc -l | tr -d ' ')
dlq_size: $(wc -l < scripts/dlq.jsonl 2>/dev/null | tr -d ' ' || echo 0)
disk_free_kb: ${FREE_KB:-unknown}
agy_version: $(agy --version 2>/dev/null || echo unknown)
python_version: $(python3 --version 2>/dev/null || echo unknown)
"

# ─── Run agy — with one retry on transient failure ──────────────────────────
run_agy() {
  timeout "$SHELL_TIMEOUT_SECONDS" agy \
    --print \
    --print-timeout "$AGY_PRINT_TIMEOUT" \
    --dangerously-skip-permissions \
    -p "${PROMPT_PREFIX}$(cat CRONJOB.md)
${RUNTIME_CONTEXT}" \
    2>&1 | tee -a "$LOG_FILE"
  # Return agy's exit code (not tee's)
  return "${PIPESTATUS[0]}"
}

echo ""
echo "INFO: Launching agy agent (print-timeout: ${AGY_PRINT_TIMEOUT})..."
echo ""

AGY_EXIT=0
run_agy || AGY_EXIT=$?

# ─── Single retry on transient error (exit 1, not timeout) ───────────────────
if [ "$AGY_EXIT" -eq 1 ]; then
  echo ""
  echo "WARN: agy exited with code 1. Waiting 30s then retrying once (transient error?)."
  sleep 30
  AGY_EXIT=0
  run_agy || AGY_EXIT=$?
fi

# ─── Exit handling ────────────────────────────────────────────────────────────
if [ "$AGY_EXIT" -eq 124 ]; then
  echo ""
  echo "TIMEOUT: agy hit ${SHELL_TIMEOUT_SECONDS}s shell timeout."
  echo "Work committed during the run is preserved. Check git log."
  printf '{"event":"shell_timeout","at":"%s"}\n' "$TIMESTAMP" >> .agent/incident_log.md
  # Exit 0: timeout is expected behavior, not an error
  exit 0
fi

if [ "$AGY_EXIT" -ne 0 ]; then
  echo ""
  echo "ERROR: agy exited with code ${AGY_EXIT} after retry."
  printf '{"event":"agy_error","exit_code":%d,"at":"%s"}\n' "$AGY_EXIT" "$TIMESTAMP" >> .agent/incident_log.md
  exit "$AGY_EXIT"
fi

echo "INFO: agy completed normally."
# Lock cleanup is handled by the trap
