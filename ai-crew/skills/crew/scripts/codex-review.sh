#!/usr/bin/env bash
# codex-review.sh — run Codex CLI as an independent reviewer (read-only) and record the verdict.
# Usage: bash codex-review.sh <round> [model]
# Exit codes: 0 = VERDICT PASS, 1 = VERDICT FAIL (or no verdict line), 2 = codex unavailable (not found / not logged in / rate limited) -> use reviewer-fallback
set -u
ROUND="${1:-1}"
MODEL="${2:-}"
TIMEOUT_SEC="${CREW_CODEX_TIMEOUT:-900}"

CREW_DIR="$(pwd)/.crew"
REQUEST="$CREW_DIR/review-request.md"
OUTPUT="$CREW_DIR/codex-review-$ROUND.md"
LOG="$CREW_DIR/codex-review-$ROUND.log"

mkdir -p "$CREW_DIR"
if [ ! -f "$REQUEST" ]; then
  echo "ERROR: $REQUEST not found. Create it first (see references/codex-review-prompt.md)."
  exit 1
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "CODEX_NOT_FOUND: install with 'npm install -g @openai/codex' then run 'codex login'. Falling back to reviewer-fallback agent."
  exit 2
fi

PROMPT="Read the file .crew/review-request.md in the current directory and perform the review exactly as it instructs. Your reply MUST start with the line 'VERDICT: PASS' or 'VERDICT: FAIL'."

ARGS=(exec --sandbox read-only --skip-git-repo-check --output-last-message "$OUTPUT")
if [ -n "$MODEL" ]; then ARGS+=(--model "$MODEL"); fi
ARGS+=("$PROMPT")

echo "Running: codex ${ARGS[*]}"
if command -v timeout >/dev/null 2>&1; then
  timeout "$TIMEOUT_SEC" codex "${ARGS[@]}" >"$LOG" 2>"$LOG.err"
else
  codex "${ARGS[@]}" >"$LOG" 2>"$LOG.err"
fi
RC=$?

if grep -qiE "not logged in|login required|unauthorized|401" "$LOG.err" 2>/dev/null; then
  echo "CODEX_NOT_LOGGED_IN: run 'codex login' once. Falling back to reviewer-fallback agent."
  exit 2
fi
if cat "$LOG" "$LOG.err" 2>/dev/null | grep -qiE "rate limit|usage limit|limit reached|quota|too many requests|429|insufficient_quota|plan limit"; then
  echo "CODEX_RATE_LIMITED: Codex usage limit hit. Falling back to reviewer-fallback agent (Opus) for this round."
  exit 2
fi

if [ ! -f "$OUTPUT" ]; then
  echo "ERROR: codex produced no output file (exit $RC). See $LOG and $LOG.err"
  exit 1
fi

echo "----- Codex review (round $ROUND) -----"
cat "$OUTPUT"
echo "----- end -----"

if grep -qE '^\s*VERDICT:\s*PASS' "$OUTPUT"; then exit 0; fi
exit 1
