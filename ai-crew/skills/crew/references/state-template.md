# <state_dir>/state.md — template (copy, then update at the end of every step)

```markdown
# crew state
status: in-progress          # in-progress | done | blocked
started: 2026-09-12 10:05
mode: normal                 # from merged config
reply_language: th
round: 0                     # current review round (0 = not reviewed yet); max = config.max_rounds
rules_file: .crew/rules.md
model_log:
  - 10:05 lead-brain = fable (PLAN)
  # - 10:40 lead-brain = opus (fable rate-limited during TRIAGE round 1)
  # - 10:52 reviewer = opus agent (codex: REVIEWER_RATE_LIMITED, gemini: REVIEWER_NOT_FOUND)

## Merged config (as loaded this run)
<paste the merged JSON here>

## Request from the user (verbatim)
<exact text — never paraphrase>

## Scout report
- files: <full path> — <role> — <function:line> — called by <...>
- patterns: auth = ..., DB = ..., response shape = ..., path style = ..., line endings = CRLF, BOM = no
- constraints from CLAUDE.md / docs / rules: ...
- not found / unsure: ...

## Plan (lead-brain)
| # | subtask | files | owner | status | notes |
|---|---|---|---|---|---|
| 1 | ... | ... | coder | todo / doing / done / failed | |
| 2 | ... | ... | tester | todo | depends on #1 |

risk areas for the reviewer:
- ...

decisions made instead of asking the user:
- ...

## Changed files
| file (full path) | backup | edited by | round |
|---|---|---|---|
| ... | ....bak_20260912 | coder (sonnet) | 1 |

## Review rounds
- round 1: codex → FAIL, 3 findings (1 CRITICAL) → #1 to coder; #2 closed as not-real — evidence: tester ran `grep -n ... ` output: ...
- round 2: codex → PASS

## Evidence log (what was actually run)
- `php -l admin/repair_api.php` → No syntax errors
- `curl -s .../repair_api.php?action=list` → HTTP 200, 20 rows
- NOT tested here: clicking the button on the live page (user must check after upload)

## Per-model summary (for the report)
- lead (fable): ...
- coder (sonnet): ...
- tester (sonnet): ...
- scout (haiku): ...
- writer (haiku): ...
- reviewer (codex / gemini / opus): ...

## Waiting on the user
- ...
```
