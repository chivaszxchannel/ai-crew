---
name: crew-setup
description: >
  This skill should be used when the user invokes "/crew-setup", asks to "set up the crew",
  "install codex", "install gemini cli", "check whether the crew is ready", "ติดตั้ง codex",
  "เช็คว่าทีมพร้อมไหม", or before the first /crew run on a new machine. It checks Node.js, installs
  and signs in the CLI reviewers listed in config, verifies the plugin agents load, and runs a dry-run review.
metadata:
  version: "0.2.0"
---

# /crew-setup — make this machine ready for the crew

Go step by step, report briefly in the user's language. Whenever a step needs the user (sign-in in a browser), print the exact command and wait. Never sign in on the user's behalf.

## 1. Node.js and npm
`node -v && npm -v` — need Node 18+. Missing → tell the user to install Node.js LTS from https://nodejs.org and reopen the terminal; stop.

## 2. Config
Load the merged config (see `${CLAUDE_PLUGIN_ROOT}/skills/crew/references/config-schema.md`) and print the reviewer chain and model chains in force. If neither `.crew/config.json` nor `~/.claude/ai-crew.json` exists, say that defaults apply and that `/crew-config` changes them.

## 3. CLI reviewers in the chain
For each CLI reviewer in `reviewers` (`codex`, `gemini`, `antigravity`):
- **codex**: `codex --version`. Missing → `npm install -g @openai/codex`. Sign-in: `codex login status` (or `codex login --help` on older builds); if not signed in, ask the user to run `codex login` (browser, ChatGPT account — the Codex desktop app does not provide the CLI) and reply "done".
- **gemini**: `gemini --version`. Missing → `npm install -g @google/gemini-cli`. Sign-in: ask the user to run `gemini` once interactively and complete the Google sign-in, then reply "done".
- **antigravity**: `agy --version`. Missing → tell the user to install the Antigravity CLI (it ships with the Antigravity IDE, or see antigravity.google/docs/cli). Sign-in: ask the user to run `agy` once interactively and complete the Google sign-in, then reply "done". Note: the scripts always run `agy` with stdin closed because `agy -p` writes nothing to a redirected stdout otherwise.
- Windows note: npm creates `.cmd` and `.ps1` shims; the scripts prefer `.cmd`. No WSL needed.
Agent reviewers (`opus`, `sonnet`, `fable`) need nothing.

## 4. Plugin agents
Call `ai-crew:worker-scout` with a trivial task ("list 5 files at the project root"). If the agent is not found, tell the user to restart Claude Code (plugins load at start) and stop.

## 5. Dry run of the reviewer chain
1. Create `<state_dir>/review-request.md`:
   ```
   # Code review request (round 0 of 1)
   This is a connectivity test. Do not read any project file.
   ## Output format (STRICT — the first line must be the verdict)
   VERDICT: PASS
   Reply with exactly the line above and nothing else.
   ```
2. Run the chain script with the configured CLI reviewers:
   - Windows: `powershell -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}/skills/crew/scripts/review.ps1" -Round 0 -Reviewers <from config>`
   - bash/WSL/macOS: `bash "${CLAUDE_PLUGIN_ROOT}/skills/crew/scripts/review.sh" 0 <from config>`
3. Read the first line: `REVIEWER_USED: <name>` + exit 0 → ready. `NO_CLI_REVIEWER` + exit 3 → look at the per-reviewer reasons: `REVIEWER_NOT_FOUND` / `_NOT_LOGGED_IN` → back to step 3; `REVIEWER_RATE_LIMITED` → installed and signed in, quota exhausted for now: the crew will use the agent reviewer until it resets — say so. Exit 1 → show `<state_dir>/review-0-*.log` and `.err` and summarise the cause.
4. Delete only the test files (`review-request.md`, `review-0-*`). If `.gitignore` exists and lacks `<state_dir>/`, append it.

## 6. Summary
Table with rows Node, config, each CLI reviewer (installed / signed in), agents, dry-run — status and what the user must still do. If everything is ready: "Start with `/crew <task>` or just describe a code change (auto mode)."
