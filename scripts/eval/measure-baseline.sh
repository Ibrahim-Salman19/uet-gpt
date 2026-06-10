#!/usr/bin/env bash
set -euo pipefail

MEASURE_DIR="scripts/eval/measurements"
LEADERBOARD_FILE="${MEASURE_DIR}/leaderboard.jsonl"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
OUTPUT_FILE="${MEASURE_DIR}/baseline-${TIMESTAMP}.json"

mkdir -p "${MEASURE_DIR}"

CONVEX_URL="${CONVEX_URL:-}"
TOP_K="${TOP_K:-8}"
QUERIES_FILE="${QUERIES_FILE:-scripts/eval/golden_set.jsonl}"

if [ -z "${CONVEX_URL}" ] && command -v npx &>/dev/null; then
  if [ -f ".env.local" ]; then
    set -a
    source .env.local
    set +a
  fi
fi

if [ -z "${CONVEX_URL}" ]; then
  echo "ERROR: CONVEX_URL environment variable is not set."
  echo "Set it or create a .env.local file with CONVEX_URL=https://your-project.convex.cloud"
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "ERROR: node is required but not found."
  exit 1
fi

ACTION_URL="${CONVEX_URL}/api/action"

run_eval_via_api() {
  local query_file="$1"
  local top_k="$2"

  node -e "
  const https = require('https');
  const fs = require('fs');

  const lines = fs.readFileSync('${query_file}', 'utf-8').trim().split('\n');
  const queries = lines.map(line => {
    const parsed = JSON.parse(line);
    return {
      query: parsed.query,
      expectedAnswer: parsed.expected_fragment || '',
      rating: parsed.rating || null,
      category: parsed.category || null
    };
  });

  const payload = JSON.stringify({
    path: 'eval/runEval:runEval',
    args: { queries, topK: ${top_k} }
  });

  const url = new URL('${ACTION_URL}');
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        process.stdout.write(JSON.stringify(result, null, 2));
      } catch (e) {
        console.error('Parse error:', data.substring(0, 500));
        process.exit(1);
      }
    });
  });

  req.on('error', (e) => {
    console.error('Request error:', e.message);
    process.exit(1);
  });

  req.write(payload);
  req.end();
  "
}

echo "=== UET GPT Baseline Measurement ==="
echo "Timestamp: ${TIMESTAMP}"
echo "Top-K:     ${TOP_K}"
echo "Dataset:   ${QUERIES_FILE}"
echo ""

echo "Running eval against ${QUERIES_FILE}..."
RESULTS=$(run_eval_via_api "${QUERIES_FILE}" "${TOP_K}" 2>/dev/null || echo "{\"error\": \"API call failed\"}")

echo "${RESULTS}" > "${OUTPUT_FILE}"
echo "Results written to: ${OUTPUT_FILE}"

METRICS=$(echo "${RESULTS}" | node -e "
  const fs = require('fs');
  const data = JSON.parse(fs.readFileSync('/dev/stdin', 'utf-8'));
  if (data.metrics) {
    console.log(JSON.stringify(data.metrics));
  } else if (data.error) {
    console.error('Eval error:', data.error);
    process.exit(1);
  } else {
    console.error('Unexpected response format');
    process.exit(1);
  }
" < "${OUTPUT_FILE}" 2>/dev/null || echo "{\"error\": \"Metrics extraction failed\"}")

RECALL=$(echo "${METRICS}" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); console.log(d.recallAtK.toFixed(4));" 2>/dev/null || echo "0.0000")
PRECISION=$(echo "${METRICS}" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); console.log(d.precisionAtK.toFixed(4));" 2>/dev/null || echo "0.0000")
MRR=$(echo "${METRICS}" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); console.log(d.mrr.toFixed(4));" 2>/dev/null || echo "0.0000")
AVG_LATENCY=$(echo "${METRICS}" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); console.log(d.avgLatency);" 2>/dev/null || echo "0")
TOTAL_QUERIES=$(echo "${METRICS}" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); console.log(d.totalQueries);" 2>/dev/null || echo "0")

echo ""
echo "=== Results ==="
echo "Recall@K:    ${RECALL}"
echo "Precision@K: ${PRECISION}"
echo "MRR:         ${MRR}"
echo "Avg Latency: ${AVG_LATENCY}ms"
echo "Queries:     ${TOTAL_QUERIES}"

LEADERBOARD_ENTRY="{\"timestamp\":\"${TIMESTAMP}\",\"recallAtK\":${RECALL},\"precisionAtK\":${PRECISION},\"mrr\":${MRR},\"avgLatency\":${AVG_LATENCY},\"totalQueries\":${TOTAL_QUERIES},\"topK\":${TOP_K},\"dataset\":\"$(basename ${QUERIES_FILE})\",\"file\":\"$(basename ${OUTPUT_FILE})\"}"

echo "${LEADERBOARD_ENTRY}" >> "${LEADERBOARD_FILE}"
echo ""
echo "Leaderboard updated: ${LEADERBOARD_FILE}"

echo ""
echo "=== Leaderboard (last 5 runs) ==="
tail -5 "${LEADERBOARD_FILE}" 2>/dev/null | while read -r line; do
  echo "${line}" | node -e "
    const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8'));
    console.log(d.timestamp, 'recall=' + d.recallAtK, 'prec=' + d.precisionAtK, 'mrr=' + d.mrr, d.avgLatency + 'ms', 'k=' + d.topK);
  " 2>/dev/null
done || echo "(no leaderboard entries yet)"

echo ""
echo "Done. Results: ${OUTPUT_FILE}"
