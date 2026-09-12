#!/usr/bin/env bash
# review.sh - run an independent CLI reviewer (read-only) over .crew/review-request.md and record the verdict.
# Usage: bash review.sh <round> [reviewers=codex,gemini] [model] [state_dir=.crew]
# NOTE: Antigravity (agy) is NOT a reviewer here - it is the optional image provider (tools/gen-image.mjs).
# Tries each CLI reviewer in order. Exit codes:
#   0 = VERDICT: PASS   1 = VERDICT: FAIL (or no verdict line)   3 = no CLI reviewer available -> use reviewer-fallback agent
# First line of output: REVIEWER_USED: <name> | NO_CLI_REVIEWER (with per-reviewer reasons: REVIEWER_NOT_FOUND / _NOT_LOGGED_IN / _RATE_LIMITED / _ERROR)
set -u
ROUND="${1:-1}"
REVIEWERS="${2:-codex,gemini}"   # CLI reviewers only: codex, gemini
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
    *) RES_CODE=2; RES_REASON="REVIEWER_NOT_FOUND: unknown CLI reviewer '$name'"; return ;;
  esac
  # A real VERDICT line is proof the reviewer ran and answered. Trust it BEFORE scanning the log
  # for trouble words: the log holds the reviewer's whole transcript, which routinely quotes the
  # diff under review - and a diff that touches rate-limiting or quota code contains "rate limit"
  # and "quota" itself. Scanning first threw away good reviews as REVIEWER_RATE_LIMITED.
  if [ -f "$out" ] && grep -qE '^[[:space:]]*VERDICT:[[:space:]]*PASS' "$out"; then RES_FILE="$out"; RES_REASON="REVIEWER_USED: $name"; RES_CODE=0; return; fi
  if [ -f "$out" ] && grep -qE '^[[:space:]]*VERDICT:[[:space:]]*FAIL' "$out"; then RES_FILE="$out"; RES_REASON="REVIEWER_USED: $name"; RES_CODE=1; return; fi

  # No verdict, so classify from the log. Scan stderr always, but stdout ONLY when the reviewer
  # produced nothing usable: stdout is the transcript, and a reviewer that answered at all has
  # already quoted the diff into it. A reviewer that truly failed writes its error to stderr, or
  # leaves stdout as the only thing there is.
  local all; all="$(cat "$log.err" 2>/dev/null)"
  [ -s "$out" ] || all="$all
$(cat "$log" 2>/dev/null)"
  if echo "$all" | grep -qiE "not logged in|login required|unauthorized|401|please sign in|authentication"; then RES_CODE=2; RES_REASON="REVIEWER_NOT_LOGGED_IN: $name"; return; fi
  if echo "$all" | grep -qiE "rate limit|usage limit|limit reached|quota|too many requests|429|insufficient_quota|plan limit|resource_exhausted"; then RES_CODE=2; RES_REASON="REVIEWER_RATE_LIMITED: $name"; return; fi
  [ -s "$out" ] || { RES_CODE=2; RES_REASON="REVIEWER_ERROR: $name produced no output (exit $rc, see $log / $log.err)"; return; }

  # Output exists but carries no verdict line and no recognisable error: treat as FAIL and show it,
  # so the lead reads what actually came back instead of a guess about why.
  RES_FILE="$out"; RES_REASON="REVIEWER_USED: $name (no VERDICT line - output shown verbatim)"; RES_CODE=1
}

TRIED=()
# Same normalisation as review.ps1's .Trim().ToLower(), and the same normalised list is what the
# failure line echoes back - so the two scripts report identically for identical input.
IFS=',' read -r -a RAW <<< "$REVIEWERS"
LIST=()
for r in "${RAW[@]}"; do
  r="$(echo "$r" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
  [ -n "$r" ] && LIST+=("$r")
done
# A blank/whitespace-only list means "not specified", not "no reviewers" - same as review.ps1.
[ "${#LIST[@]}" -eq 0 ] && LIST=(codex gemini)
SHOWN=""; for r in "${LIST[@]:-}"; do [ -n "$r" ] && SHOWN="${SHOWN:+$SHOWN, }$r"; done   # ", " join, same as PowerShell's -join ', '
for r in "${LIST[@]:-}"; do
  [ -n "$r" ] || continue
  case "$r" in codex|gemini) ;; *) continue ;; esac     # agent reviewers are handled by the skill
  RES_CODE=2; RES_REASON=""; RES_FILE=""
  run_reviewer "$r"
  TRIED+=("$r: $RES_REASON")
  if [ "$RES_CODE" -le 1 ]; then
    echo "$RES_REASON"; echo "REVIEW_FILE: $RES_FILE"
    echo "----- review (round $ROUND, $r) -----"; cat "$RES_FILE"; echo "----- end -----"
    exit "$RES_CODE"
  fi
done
if [ "${#TRIED[@]}" -eq 0 ]; then
  # Nothing in the list was a CLI reviewer this script knows - say so, rather than letting it
  # read as though the reviewers were tried and found unavailable.
  echo "NO_CLI_REVIEWER: no known CLI reviewer in [$SHOWN] (known: codex, gemini) -> use the reviewer-fallback agent"
else
  echo "NO_CLI_REVIEWER: none of [$SHOWN] could run this round -> use the reviewer-fallback agent"
fi
for t in "${TRIED[@]:-}"; do [ -n "$t" ] && echo "  $t"; done
exit 3
