---
name: crew-config
description: >
  This skill should be used when the user invokes "/crew-config", or asks to "configure the crew",
  "change the crew models", "set the review mode", "use eco mode", "ตั้งค่าทีม", "เปลี่ยนโมเดล",
  "set up rules for this project", or wants to see or edit which models, reviewers, rounds and
  project rules the crew uses. It walks through the choices with multiple-choice questions and writes
  .crew/config.json, .crew/rules.md, or ~/.claude/ai-crew.json.
metadata:
  version: "0.2.0"
---

# /crew-config — pick models, mode, reviewers and project rules by clicking

Runs as a short guided wizard. Use `AskUserQuestion` for every choice (it renders as clickable options in Claude Code, the VS Code extension, and Cowork). Speak the user's language (`language` in config, or the language they typed in).

Arguments: `/crew-config` (project), `/crew-config --global` (write `~/.claude/ai-crew.json` instead), `/crew-config show` (print the merged config and stop), `/crew-config rules` (only regenerate the rules file).

## 1. Show current state (no questions yet)

Load the merged config as in `${CLAUDE_PLUGIN_ROOT}/skills/crew/references/config-schema.md` and print a 6-line summary: mode, lead chain, coder/tester chain, scout/writer chain, reviewers, max rounds, rules file (exists / missing), language. If the argument was `show`, stop here.

## 2. Ask, one question at a time (skip any the user already answered in their message)

1. **Scope** — "Save for this project only, or as your default for all projects?" → project (`.crew/config.json`) / global (`~/.claude/ai-crew.json`). `--global` skips this.
2. **Mode** — eco / normal (recommended) / strict, each with its one-line description from `config/modes.json`.
3. **Lead model chain** — options: `fable → opus → session` (recommended) / `opus → sonnet` / `sonnet only (cheapest)` / custom (free text: comma-separated).
4. **Worker models** — "Coding on Sonnet, reading & docs on Haiku (recommended)" / "Everything on Haiku (cheapest)" / "Coding on Opus (strongest)" / custom.
5. **Reviewers** — multi-select: Codex CLI, Gemini CLI, Antigravity CLI (`agy`), Opus agent, Sonnet agent. Order = the order the user lists them; default `codex, gemini, opus`. If the user picks a CLI that is not installed (`Get-Command`/`command -v`), say so and offer to install it now (`npm install -g @openai/codex` / `npm install -g @google/gemini-cli`; Antigravity CLI ships with the Antigravity IDE) — never install without a yes.
6. **Review rounds** — 1 / 3 (recommended) / 5 / until pass (`99`).
7. **Auto mode** — "Start the crew automatically for any code change" (recommended) / "Only for changes touching 2+ files" / "Only when I type /crew".
8. **Reply language** — auto (recommended) / Thai / English / other (free text).
9. **Git** — "Never commit, I do it" (recommended) / "Propose a commit and ask" / "Commit automatically after PASS".
10. **Project rules** (project scope only) — detect the stack and propose the matching template from `${CLAUDE_PLUGIN_ROOT}/templates/rules/` (php-hostinger / nextjs-supabase / node-python-generic / generic); options: use it / use a different template / keep my existing rules file. Then ask the two fill-in questions the template needs (syntax-check command, how code reaches production) and substitute them into the `<...>` placeholders.

## 3. Write

- Write only the keys the user chose (leave the rest to defaults) as pretty JSON to the chosen path. Back up an existing file first (`config.json.bak_YYYYMMDD`, `cp -n`).
- Write the rules file to `rules_file` (default `.crew/rules.md`) if the user chose a template; never overwrite an existing rules file without asking.
- If `.gitignore` exists and lacks `.crew/`, append it.
- Print the final merged config (same 6-line summary as step 1) and say: "Takes effect on the next /crew run in this project" (no restart needed — config is read at run time).

## Rules

- Never guess a value the user did not choose; defaults come from `config/defaults.json`.
- Never install CLIs or change global files without an explicit yes.
- Keep the wizard under 10 questions; skip anything already answered.
