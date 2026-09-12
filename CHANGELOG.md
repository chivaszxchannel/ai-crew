# Changelog

## 0.2.1
- Antigravity CLI (`agy`) can be used as a reviewer alongside Codex and Gemini. It is always run with stdin closed, because `agy -p` writes nothing to a redirected stdout otherwise (antigravity-cli issue #76).

## 0.2.0
- **Configurable.** Model chain per role, reviewer chain, rounds, language, git policy and auto-mode thresholds now come from config: plugin defaults → mode preset → `~/.claude/ai-crew.json` → `<project>/.crew/config.json` → `/crew` flags.
- **Modes:** `eco`, `normal`, `strict` (`/crew --eco`, or set `mode` in config).
- **`/crew-config`** — click-through wizard that writes the config and the project rules file.
- **Reviewer chain instead of one reviewer.** `review.ps1` / `review.sh` try each CLI reviewer in order and report exactly why each was skipped (`REVIEWER_NOT_FOUND` / `_NOT_LOGGED_IN` / `_RATE_LIMITED` / `_ERROR`); the agent reviewer is the last resort.
- **Project-agnostic.** Stack-specific rules moved out of the skills into `templates/rules/*.md` (PHP shared hosting, Next.js + Supabase, Node/Python, generic), auto-detected and copied to `.crew/rules.md` on first run.
- **English source, user's language in replies.** `language: auto` answers in whatever language the task was written in.
- MIT licence, README, Thai installation guide.

## 0.1.3
- Evidence rule ("no guessing") enforced across the lead, workers and the report: every conclusion needs a re-runnable command output or `file:line`; CRITICAL/HIGH findings can only be closed as not-real with tester proof; the report separates "tested here" from "you must test".

## 0.1.2
- Auto-mode hook fixed (the `echo` payload was unquoted and broke in Git Bash).
- Reviewer exit code 2 now distinguishes not-installed / not-logged-in / rate-limited, and the report must state the real reason.

## 0.1.1
- Auto mode: a `UserPromptSubmit` hook lets the crew start without typing `/crew`.
- Rate-limit detection for the reviewer.
- Windows fixes: prefer the `.cmd` shim over `.ps1`; quote arguments for Windows PowerShell 5.1, which does not quote `ArgumentList` entries.

## 0.1.0
- First version: `/crew`, `/crew-setup`, `/crew-resume`, six agents, Codex CLI review loop, `.crew/state.md` for resuming after a model switch.
