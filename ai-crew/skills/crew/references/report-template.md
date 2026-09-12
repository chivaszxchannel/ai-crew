# Final report — template (lead-brain writes it; the chair sends it unchanged)

One screen max. In the reply language (config `language`; `auto` = the user's language). Tell what was done to the code, not how the process went. No emoji unless the user uses them.

```markdown
## Done: <short task name>
Status: complete | partial | blocked   (review round 2/3: PASS by codex)

### Who did what
- Lead (Fable; switched to Opus in round 2 — Fable rate-limited): planned 4 subtasks, decided <one key decision>, deferred reviewer finding #3 because <evidence>
- Sonnet (coder): changed <file> to <what>; round 2 fixed <bug> found by the reviewer
- Sonnet (tester): php -l clean on 3 files; brace/CRLF/BOM match backups; callers of <fn> unchanged (grep)
- Haiku (scout): found <the fact that changed the plan, if any>
- Haiku (writer): wrote <docs / review request>
- Reviewer — Codex: round 1 FAIL (CRITICAL: <title>), round 2 PASS   [or: Opus (fallback, Codex rate-limited)]

### Changed files (upload / commit exactly these)
1. <full path>  — backup: <path.bak_YYYYMMDD>
2. ...

### Tested here vs. must be tested by you
- Tested (evidence in state.md): <e.g. php -l all files; curl repair_api.php?action=list → 200, 20 rows>
- Not tested here (please check after deploy): <e.g. clicking the new button on the live page; login on iPhone>

### Waiting on you
- <decision or "none">

Not committed. Full details: <state_dir>/state.md
```

If status is **blocked** (rounds exhausted, still FAIL): add a section "Open findings" with one line per finding plus the lead's recommendation (keep fixing / accept the risk / change approach).

If `git.commit` is `ask`: end with a proposed commit message and wait. If `auto`: state the commit hash.
