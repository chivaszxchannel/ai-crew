# bm-plugins

A Claude Code plugin marketplace. One plugin so far:

## ai-crew

A **multi-model engineering crew** for Claude Code. A lead model plans and splits the job, cheaper worker models build and test, and an **independent reviewer from another vendor** (Codex, Gemini or Antigravity CLI) checks the diff. The loop repeats until it passes, then you get a one-screen report — in your language — saying what each model did, which files changed, and what was actually tested versus what you still need to check yourself.

```
you ──► chair (session model) ──► scout (haiku) ──► lead (fable → opus) plans
                                       │
                                       ├──► coder (sonnet) ──► tester (sonnet) ──► review request
                                       │                                              │
                                       │         codex ──► gemini ──► agy ──► opus   ◄┘  (first available)
                                       │                       │
                                       └──── lead triages ◄────┘  FAIL → fix → next round (max 3)
                                                     PASS → report
```

**Install**

```
claude plugin marketplace add chivaszxchannel/ai-crew
claude plugin install ai-crew@bm-plugins
```

(The second command is not a typo: `ai-crew` is the plugin, `bm-plugins` is the marketplace name declared in `.claude-plugin/marketplace.json`. Run both in a **terminal**, not in the chat box.)

Then restart Claude Code, run `/crew-setup` once per machine and `/crew-config` once per project.

- Full documentation: [`ai-crew/README.md`](ai-crew/README.md)
- **คู่มือติดตั้งภาษาไทยแบบละเอียด: [`INSTALL-TH.md`](INSTALL-TH.md)**
- Changes: [`CHANGELOG.md`](CHANGELOG.md)

Works with the Claude Code CLI, the VS Code / JetBrains extensions, and Claude Cowork.

MIT licensed.

---

## ภาษาไทย

`ai-crew` คือปลั๊กอินที่ทำให้โมเดลหลายตัวทำงานเป็นทีมใน Claude Code — หัวหน้าวางแผนแตกงาน ลูกน้องโมเดลถูกกว่าเขียนโค้ดและทดสอบ แล้วส่งให้ผู้ตรวจต่างค่าย (Codex / Gemini / Antigravity) ตรวจบั๊ก วนแก้จนผ่าน แล้วรายงานสั้นๆ เป็นภาษาไทยว่าแต่ละโมเดลทำอะไร ไฟล์ไหนต้องอัปโหลด อะไรทดสอบแล้วจริง อะไรต้องไปกดดูเอง

อ่านวิธีติดตั้งแบบละเอียดทีละขั้นที่ **[INSTALL-TH.md](INSTALL-TH.md)**
