# Changelog

## 0.4.2
Three things an independent review of 0.4.1 found. The first is the same class of silent failure as the Windows bug 0.4.1 fixed, on a different axis.

- **A good review could be thrown away as "rate-limited".** Both scripts scanned the reviewer's combined stdout and stderr for `rate limit`, `quota`, `429` and so on **before** reading the verdict file — but stdout is the reviewer's whole transcript, and a reviewer quotes the diff it is reviewing. Any change touching rate-limiting or quota code contains those words itself, so a successful `VERDICT: PASS` was liable to be discarded and reported as a quota problem. (This plugin's own `review.ps1` is such a file, so the crew could not review itself reliably.) A real `VERDICT:` line is now read first and trusted — it is proof the reviewer ran and answered — and the log is classified only when no verdict came back. When the log must be read, stderr is always scanned but stdout only when the reviewer produced nothing usable.
- Output that arrives with no `VERDICT:` line and no recognisable error is now returned as FAIL with the text shown verbatim and labelled `(no VERDICT line — output shown verbatim)`, instead of being guessed at.
- **Both review scripts are now pure ASCII.** Windows PowerShell 5.1 reads a `.ps1` with no byte-order mark as Windows-1252, so a non-ASCII character anywhere in *code* (an em-dash in a string, say) corrupts the parse and the whole script fails before any reviewer runs. The scripts now use only ASCII, verified byte-for-byte, so they parse the same under PS 5.1, PowerShell 7 and bash regardless of how an editor saves them.
- **`review.ps1` and `review.sh` now behave identically on every input.** 0.4.1 normalised case in PowerShell but not in bash, so `Codex,Gemini` written by hand into `config.json` worked on Windows and skipped both reviewers under bash — silently, in the same way as the 0.4.1 bug. Both now trim and lowercase, both fall back to the default list when given a blank value, and both echo the normalised list back. Verified identical across 13 cases (case, spaces, empty entries, blank, unknown names; PASS / FAIL / rate-limited / no-verdict).

## 0.4.1
Fixes for problems found by an independent review of 0.4.0 **after** it was published. Upgrade from 0.4.0 is recommended.

- **On Windows the CLI reviewer was never actually run, and the output did not say so.** `review.ps1` declared `-Reviewers` as `[string[]]`, but `powershell -File script.ps1 -Reviewers codex,gemini` passes arguments as literal strings, so the parameter bound a single element `"codex,gemini"` — which matches no reviewer, so every one was skipped. The failure line still read `none of [codex, gemini] could run this round`, because joining a one-element array reproduces the original text. Every round on Windows fell through to the agent reviewer while appearing to have tried Codex and Gemini. `-Reviewers` is now one comma-separated string that the script splits itself, matching `review.sh`; `-File` then yields both the correct list and the correct exit code (`-Command` binds the array but turns exit 3 into 1, which would have broken the fallback branch instead). Verified on PowerShell 7.4.6 and on Windows PowerShell 5.1.19041.6456: PASS→0, FAIL→1, none available→3, missing request→1, reviewer order respected.
- Both scripts now distinguish "these reviewers were tried and none could run" from "none of the configured names is a CLI reviewer at all", so a mis-typed `reviewers` list cannot masquerade as a quota problem. The `/crew` and `/crew-setup` skills are told to read the per-reviewer reason lines, not just the exit code.
- **Saving from the settings page no longer wipes keys it does not display.** It replaced the whole file, silently dropping `double_review`, `state_dir`, `backup_suffix`, `deploy` and `image` — so turning image generation off and then pressing Save quietly turned it back on. It now merges over whatever is already in that scope's file.
- **The settings page gained the image card it was documented as having.** 0.4.0's notes said `/crew-config` could set the image provider; that was only true of the question flow, not the page. The page now has provider, `agy` status with a Login button, output folder and default size.
- **Antigravity is the image provider only — it is no longer offered as a reviewer.** It is the same model family as Gemini, so it added nothing as a second opinion, and it is the only CLI here with an image tool. Removed from `review.ps1`, `review.sh`, the config schema, the question flow and the settings page. Reviewers are `codex`, `gemini` and the agent reviewers.
- **`image.provider` now defaults to `"none"`.** In 0.4.0 it defaulted to `"agy"`, so anyone installing on a machine without the Antigravity CLI hit exit 2 the first time they ran `/crew-image`. Turn it on in `/crew-config` or the settings page.
- `gen-image.mjs` created the output folder before checking the provider, leaving an empty directory behind when the provider was missing. The filesystem is only touched after the check passes.
- The terminal window opened by the Login and Install buttons on Windows now runs `chcp 65001` first, so Thai text is not mojibake under code page 437.
- `plugin.json`, `marketplace.json` and `defaults.json` end with a newline.

## 0.4.0
- **Optional image generation** — `/crew-image` creates picture assets (hero, banner, og:image, placeholder) through the Antigravity CLI's built-in image tool, and the crew can produce one itself when a plan needs an asset that does not exist.
- The tool **measures the real pixel size from the file header** and compares it with what was requested; the provider defaults to a 1024x1024 square and honours aspect-ratio wording inconsistently. On a mismatch it crops with ffmpeg/ImageMagick when available, and otherwise **reports the size it actually got** rather than the one requested. Exit codes: 0 matched, 1 wrong size, 2 provider unavailable, 3 nothing produced.
- Generated files are always labelled AI-generated in the reply and the report, and the prompt is recorded in the state file. Real people, logos, trademarks, copyrighted characters and anything that could pass as a genuine photograph or record are refused.
- New config block `image` (`provider`, `out_dir`, `default_size`, `disclose`). Shipped with `provider: "agy"` and with Antigravity also listed as a reviewer — both changed in 0.4.1.

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
