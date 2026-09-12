# Changelog

## 0.4.0
- **Optional image generation** — `/crew-image` creates picture assets (hero, banner, og:image, placeholder) through the Antigravity CLI's built-in image tool, and the crew can produce one itself when a plan needs an asset that does not exist.
- The tool **measures the real pixel size from the file header** and compares it with what was requested; the provider defaults to a 1024x1024 square and honours aspect-ratio wording inconsistently. On a mismatch it crops with ffmpeg/ImageMagick when available, and otherwise **reports the size it actually got** rather than the one requested. Exit codes: 0 matched, 1 wrong size, 2 provider unavailable, 3 nothing produced.
- Generated files are always labelled AI-generated in the reply and the report, and the prompt is recorded in the state file. Real people, logos, trademarks, copyrighted characters and anything that could pass as a genuine photograph or record are refused.
- New config block `image` (`provider`, `out_dir`, `default_size`, `disclose`); `/crew-config` gained a question for it. Set `provider: "none"` to disable.

## 0.3.1
- Documentation: the settings page is now documented in detail in all three guides, with real screenshots (light and dark) and a rendered flow diagram. Thai manual gains a full chapter on the visual settings page plus five new troubleshooting rows.

## 0.3.0
- **Graphical settings page** — `/crew-config ui` (or `node tools/config-ui.mjs`) opens a local page in your browser: dropdowns for every role's model chain, mode presets, reviewer list with live installed/signed-in status, rounds, language, auto-mode, git policy and the project rules template. Saving writes the same files the wizard writes and backs up anything it replaces.
- **One-click install and sign-in** — the reviewer rows have buttons that open a real terminal window running `npm install -g ...` or the vendor's own `login` command. The page never asks for, sees, or stores a token.
- No npm dependencies; single file, Node 18+. The server binds 127.0.0.1, requires a one-time token in the URL, rejects cross-origin requests, and exits after 30 minutes idle.
- **Leak guard for maintainers** — `.githooks/pre-commit` blocks committing crew state, backups, key material and any string listed in a local (gitignored) `.secrets-patterns`; `.githooks/audit-leak` scans every tracked file and the whole history.

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
