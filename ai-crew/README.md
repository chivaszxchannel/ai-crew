# ai-crew — a multi-model engineering crew for Claude Code

One lead model plans and splits the job. Cheaper worker models build and test. An **independent reviewer from another vendor** (Codex, Gemini or Antigravity CLI) checks the diff. The loop repeats until it passes. You get a short report, in your language, saying what each model did and which files to deploy.

Works anywhere Claude Code runs: the CLI, the VS Code / JetBrains extensions, and Claude Cowork.

```
you ──► chair (session model) ──► scout (haiku) ──► lead-brain (fable → opus) plans
                                       │
                                       ├──► coder (sonnet) ──► tester (sonnet) ──► review request
                                       │                                              │
                                       │            codex ──► gemini ──► opus agent  ◄┘  (first available)
                                       │                       │
                                       └──── lead triages ◄────┘  FAIL → fix → next round (max 3)
                                                     PASS → report: who did what · changed files · tested vs. not
```

## Why

- **Different vendor, different blind spots.** The model that wrote the code should not be the only one checking it.
- **Spend the expensive model only on thinking.** Planning, triage and the report go to the lead; reading and writing go to Haiku; coding to Sonnet.
- **Evidence, not confidence.** Every claim in the report is backed by a command output or a `file:line`. "Tested" means it ran. Anything not run is listed for you to test.
- **Survives limits.** The lead fails over between models automatically; the job state lives in `.crew/state.md`, so a new session or a `/model` switch picks up where it stopped.

## Install

**From GitHub (marketplace):**
```
claude plugin marketplace add chivaszxchannel/ai-crew
claude plugin install ai-crew@bm-plugins
```

**From a local folder:** clone or unzip, then
```
claude plugin marketplace add C:\path\to\bm-plugins      # folder that contains .claude-plugin/marketplace.json
claude plugin install ai-crew@bm-plugins
```
The VS Code extension does not accept `/plugin` in its chat box — run the two commands in the integrated terminal, then reload the window. Cowork: accept the `.plugin` file card.

**Then, once per machine:** `/crew-setup` — checks Node, installs and signs in the CLI reviewers you configured (Codex: `npm i -g @openai/codex` + `codex login`; Gemini: `npm i -g @google/gemini-cli`), verifies the agents, and dry-runs the review chain.

**Then, once per project:** `/crew-config` — a click-through wizard that writes `.crew/config.json` (models, mode, reviewers, rounds, language, git policy) and `.crew/rules.md` from a stack template (PHP on shared hosting, Next.js + Supabase, Node/Python, generic).

## Use

| Command | What it does |
|---|---|
| just describe a code change | **auto mode** (default on): the crew starts by itself for anything that touches project files; questions are answered directly. Add "no crew" to skip. |
| `/crew <task>` | force the crew. Flags: `--eco` `--normal` `--strict` `--rounds N` `--lang th` `--no-auto` |
| `/crew-resume` or "continue" | pick up an in-progress job after a new session or `/model` switch |
| `/crew-config` | change models / mode / reviewers / rules by clicking; `--global` for all projects; `show` to print |
| `/crew-setup` | install and verify reviewer CLIs, dry-run |

## Configuration

Layers, later wins: `config/defaults.json` → `config/modes.json[mode]` → `~/.claude/ai-crew.json` → `<project>/.crew/config.json` → `/crew` flags.

```json
{
  "language": "auto",
  "mode": "normal",
  "models": {
    "lead":   ["fable", "opus", "inherit"],
    "coder":  ["sonnet", "haiku"],
    "tester": ["sonnet", "haiku"],
    "scout":  ["haiku", "sonnet"],
    "writer": ["haiku", "sonnet"]
  },
  "reviewers": ["codex", "gemini", "opus"],
  "max_rounds": 3,
  "double_review": false,
  "auto_mode": true,
  "auto_mode_min_files": 1,
  "rules_file": ".crew/rules.md",
  "git": { "commit": "never" },
  "deploy": { "manual": true, "list_changed_files": true }
}
```

Each model entry is a fallback chain: on error, rate limit or "unavailable" the next one is tried and the switch is logged in the report. `inherit` = the model running the session.

**Modes:** `eco` (Sonnet lead, Haiku workers, 1 round — for small tasks or when quota is nearly gone) · `normal` (default) · `strict` (Opus coder, two reviewers must both pass, 4 rounds — for auth, payments, migrations).

**Reviewers:** `codex`, `gemini` and `antigravity` (the `agy` CLI) run read-only against `.crew/review-request.md` and are parsed for a `VERDICT: PASS|FAIL` line. `opus` / `sonnet` / `fable` run the built-in `reviewer-fallback` agent. The first available one is used; the report always states which reviewer ran and why others were skipped (`not found` / `not signed in` / `rate-limited`).

Full key reference: `skills/crew/references/config-schema.md`.

## What it never does

Commit, push, delete files, deploy, or touch credential files — unless you ask in that message (`git.commit` can be set to `ask` or `auto`). It backs up every file before editing (`file.bak_YYYYMMDD`) and preserves line endings and encoding.

## Files it creates in your project

`.crew/state.md` (team memory), `.crew/config.json`, `.crew/rules.md`, `.crew/review-request.md`, `.crew/review-N-<reviewer>.md|.log`. It adds `.crew/` to `.gitignore` once.

## Limits to know

- The plugin cannot change the model of the running session (Claude Code does not expose that). It fails over the *lead's thinking* between models; if your whole account is rate-limited, it saves state and asks you to `/model` and `/crew-resume`.
- Codex CLI uses your ChatGPT plan's Codex quota (shared with the Codex app). Gemini CLI uses your Google account's quota. `OPENAI_API_KEY` / `GEMINI_API_KEY` switch them to pay-as-you-go if you prefer.
- Auto mode routes every code change through the crew — slower and more quota than a direct edit. Set `auto_mode_min_files: 2` or `auto_mode: false` if that is too much.

## Contributing / editing the plugin

Claude Code copies an installed plugin into `~/.claude/plugins/cache/<marketplace>/ai-crew/<version>`. After editing the source, bump `version` in `.claude-plugin/plugin.json` and `marketplace.json`, run `claude plugin update ai-crew@bm-plugins`, and restart. `claude plugin validate .claude-plugin/plugin.json` checks the structure.

---

## ภาษาไทย (สรุป)

ai-crew คือปลั๊กอินสำหรับ Claude Code ที่ทำงานเป็นทีม: หัวหน้า (Fable → Opus สลับอัตโนมัติ) วางแผนแตกงาน ลูกน้อง Sonnet เขียนโค้ดและทดสอบ Haiku หาไฟล์และเขียนเอกสาร แล้วส่งให้ผู้ตรวจต่างค่าย (Codex CLI → Gemini CLI → Antigravity CLI → Opus) ตรวจบั๊ก วนแก้จนผ่าน แล้วรายงานสั้นๆ ว่าแต่ละโมเดลทำอะไร ไฟล์ไหนต้องอัปโหลด อะไรทดสอบแล้วจริง อะไรต้องกดดูเอง

ติดตั้งครั้งเดียวต่อเครื่อง (`claude plugin marketplace add ...` แล้ว `claude plugin install ai-crew@bm-plugins` ใน terminal จากนั้น `/crew-setup`) และตั้งค่าต่อโปรเจกต์ด้วย `/crew-config` (กดเลือกโมเดล โหมด ประหยัด/ปกติ/เข้ม ผู้ตรวจ จำนวนรอบ ภาษา และกติกาของโปรเจกต์) เปิดโหมดอัตโนมัติไว้ก็ไม่ต้องพิมพ์ `/crew` แค่บอกงานที่ต้องแก้โค้ด ทีมรับเอง พิมพ์ "ไม่ต้องใช้ทีม" ถ้าอยากแก้ตรงๆ

กติกาที่ฝังไว้: ไม่ commit ไม่ลบ ไม่อัปโหลด ไม่แตะ credential เว้นแต่สั่ง, backup ก่อนแก้ทุกไฟล์, รักษา CRLF/encoding, และ "ไม่คิดไปเอง" ทุกข้อสรุปต้องมีหลักฐานที่รันซ้ำได้
