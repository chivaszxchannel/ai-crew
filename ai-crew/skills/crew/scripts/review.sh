#!/usr/bin/env bash
# review.sh — run an independent CLI reviewer (read-only) over .crew/review-request.md and record the verdict.
# Usage: bash review.sh <round> [reviewers=codex,gemini,antigravity] [model] [state_dir=.crew]
# Tries each CLI reviewer in order. Exit codes:
#   0 = VERDICT: PASS   1 = VERDICT: FAIL (or no verdict line)   3 = no CLI reviewer available -> use reviewer-fallback agent
# First line of output: REVIEWER_USED: <name> | NO_CLI_REVIEWER (with per-reviewer reasons: REVIEWER_NOT_FOUND / _NOT_LOGGED_IN / _RATE_LIMITED / _ERROR)
set -u
ROUND="${1:-1}"
REVIEWERS="${2:-codex,gemini}"   # any of: codex, gemini, antigravity (agy)
MODEL="${3:-}"
STATE_DIR="${4:-.crew}"
TIMEOUT_SEC="${CREW_REVIEW_TIMEOUT:-900}"
CREW_DIR="$(pwd)/$STATE_DIR"
REQUEST="$CREW_DIR/review-request.md"
mkdir -p "$CREW_DIR"
[ -f "$REQUEST" ] || { echo "REVIEWER_ERROR: $REQUEST not found"; exit 1; }

PROMPT="Read the file $STATE_DIR/review-request.md in the current directory and perform the review exactly as it instructs. Do not modify any file. Your reply MUST start with the line VERDICT: PASS or VERDICT: FAIL."

run_with_timeout() { if command -v timeout >/dev/null 2>&1; then timeout "$TIMEOUT_SEC" "$@"; else "$@"; fi; }

run_reviewer() {   # $1 = name ; sets RES_CODE, RES_REASON, RES_FILE
  local name="$1"
  local out="$CREW_DIR/review-$ROUND-$name.md" log="$CREW_DIR/review-$ROUND-$name.log"
  rm -f "$out" "$log" "$log.err"
  case "$name" in
    codex)
      command -v codex >/dev/null 2>&1 || { RES_CODE=2; RES_REASON="REVIEWER_NOT_FOUND: codex (npm install -g @openai/codex; codex login)"; return; }
      local args=(exec --sandbox read-only --skip-git-repo-check --output-last-message "$out")
      [ -n "$MODEL" ] && args+=(--model "$MODEL")
      run_with_timeout codex "${args[@]}" "$PROMPT" >"$log" 2>"$log.err"; local rc=$? ;;
    gemini)
      command -v gemini >/dev/null 2>&1 || { RES_CODE=2; RES_REASON="REVIEWER_NOT_FOUND: gemini (npm install -g @google/gemini-cli; run gemini once to sign in)"; return; }
      local args=(-p "$PROMPT")
      [ -n "$MODEL" ] && args+=(-m "$MODEL")
      run_with_timeout gemini "${args[@]}" </dev/null >"$log" 2>"$log.err"; local rc=$?
      [ -s "$log" ] && [ ! -f "$out" ] && cp "$log" "$out" ;;
    antigravity|agy)
      # Antigravity CLI. stdin MUST be closed: agy -p writes nothing to a redirected stdout
      # unless stdin is not a TTY-waiting handle (google-antigravity/antigravity-cli issue #76).
      command -v agy >/dev/null 2>&1 || { RES_CODE=2; RES_REASON="REVIEWER_NOT_FOUND: agy (install Antigravity CLI, then run agy once to sign in)"; return; }
      local args=(-p "$PROMPT" --output-format text)
      [ -n "$MODEL" ] && args+=(--model "$MODEL")
      run_with_timeout agy "${args[@]}" </dev/null >"$log" 2>"$log.err"; local rc=$?
      [ -s "$log" ] && [ ! -f "$out" ] && cp "$log" "$out" ;;
    *) RES_CODE=2; RES_REASON="REVIEWER_NOT_FOUND: unknown CLI reviewer '$name'"; return ;;
  esac
  local all; all="$(cat "$log" "$log.err" 2>/dev/null)"
  if echo "$all" | grep -qiE "not logged in|login required|unauthorized|401|please sign in|authentication"; then RES_CODE=2; RES_REASON="REVIEWER_NOT_LOGGED_IN: $name"; return; fi
  if echo "$all" | grep -qiE "rate limit|usage limit|limit reached|quota|too many requests|429|insufficient_quota|plan limit|resource_exhausted"; then RES_CODE=2; RES_REASON="REVIEWER_RATE_LIMITED: $name"; return; fi
  [ -f "$out" ] || { RES_CODE=2; RES_REASON="REVIEWER_ERROR: $name produced no output (exit $rc, see $log / $log.err)"; return; }
  RES_FILE="$out"; RES_REASON="REVIEWER_USED: $name"
  if grep -qE '^\s*VERDICT:\s*PASS' "$out"; then RES_CODE=0; else RES_CODE=1; fi
}

TRIED=()
IFS=',' read -r -a LIST <<< "$REVIEWERS"
for r in "${LIST[@]}"; do
  r="$(echo "$r" | tr -d ' ')"
  case "$r" in codex|gemini|antigravity|agy) ;; *) continue ;; esac     # agent reviewers are handled by the skill
  RES_CODE=2; RES_REASON=""; RES_FILE=""
  run_reviewer "$r"
  TRIED+=("$r: $RES_REASON")
  if [ "$RES_CODE" -le 1 ]; then
    echo "$RES_REASON"; echo "REVIEW_FILE: $RES_FILE"
    echo "----- review (round $ROUND, $r) -----"; cat "$RES_FILE"; echo "----- end -----"
    exit "$RES_CODE"
  fi
done
echo "NO_CLI_REVIEWER: none of [$REVIEWERS] could run this round -> use the reviewer-fallback agent"
for t in "${TRIED[@]}"; do echo "  $t"; done
exit 3
