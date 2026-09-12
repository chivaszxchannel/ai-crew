# ai-crew

**ทีมงาน AI หลายโมเดลสำหรับ Claude Code**
A multi-model engineering crew for Claude Code — plan, build, review, repeat.

[![install](https://img.shields.io/badge/install-claude%20plugin-orange)](#ติดตั้ง--install) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![docs](https://img.shields.io/badge/คู่มือไทย-INSTALL--TH.md-green)](INSTALL-TH.md)

---

## นี่คืออะไร / What is this

ปกติเวลาใช้ AI เขียนโค้ด เราใช้โมเดลตัวเดียวทำทุกอย่าง — คิด เขียน ตรวจ ซึ่งมีปัญหา 2 ข้อ: **โมเดลแพงถูกใช้ทำงานง่ายๆ ไปด้วย** (เปลือง token) และ **คนเขียนโค้ดเป็นคนตรวจโค้ดตัวเอง** (จุดบอดซ้ำกัน บั๊กเดิมไม่ถูกเจอ)

`ai-crew` แก้ทั้งสองข้อด้วยการแบ่งงานเป็นทีม:

- **หัวหน้า (lead)** — Fable → Opus สลับอัตโนมัติเมื่อติดลิมิต ทำเฉพาะงานคิด: วางแผน แตกงาน ตัดสินใจ architecture คัดกรองผลตรวจ เขียนรายงาน
- **ลูกน้อง (workers)** — Sonnet เขียนโค้ดและรันเทส, Haiku หาไฟล์/อ่านโครงสร้าง/เขียนเอกสาร
- **ผู้ตรวจอิสระ (independent reviewer)** — **Codex / Gemini / Antigravity CLI** ซึ่งเป็นโมเดล*คนละค่าย*กับคนเขียน จึงมีจุดบอดคนละแบบ ตรวจแล้วส่งกลับมาให้หัวหน้าคัดกรอง วนแก้จนผ่าน (สูงสุด 3 รอบ)

จบงานได้รายงานหน้าเดียว **ในภาษาที่คุณพิมพ์มา** บอกว่าแต่ละโมเดลทำอะไร ไฟล์ไหนเปลี่ยนบ้าง อะไรทดสอบแล้วจริง และอะไรที่คุณต้องไปกดดูเอง

> In short: a **lead model** plans and splits the work, **cheaper worker models** build and test, and an **independent reviewer from another vendor** checks the diff. The loop repeats until it passes, then you get a one-screen report in your own language.

```
คุณ ─► ประธาน (โมเดลของ session / the chair)
         │
         ├─► scout   (Haiku)         หาไฟล์ อ่าน pattern · explore
         ├─► lead    (Fable → Opus)  วางแผน แตกงาน · plan & split
         ├─► coder   (Sonnet)        เขียน / แก้โค้ด · build
         ├─► tester  (Sonnet)        รันเทส พิสูจน์ · verify
         │
         └─► ผู้ตรวจอิสระ / independent review
                codex → gemini → agy → opus   (ใช้ตัวแรกที่พร้อม)
                     │
                     ├─ FAIL → หัวหน้าคัดกรอง → แก้ → วนรอบใหม่ (สูงสุด 3)
                     └─ PASS → รายงาน / report
```

---

## ทำไมถึงออกแบบแบบนี้ / Why

| เหตุผล | Reason |
|---|---|
| **คนละค่าย จุดบอดคนละแบบ** — โมเดลที่เขียนโค้ดไม่ควรเป็นคนเดียวที่ตรวจ | Different vendor, different blind spots |
| **ใช้โมเดลแพงเฉพาะตอนคิด** — อ่านไฟล์/เขียนเอกสารให้ Haiku, เขียนโค้ดให้ Sonnet, เหลือหัวหน้าไว้วางแผนกับตัดสินใจ | Spend the expensive model only on thinking |
| **ไม่คิดไปเอง ต้องมีหลักฐาน** — ทุกข้อสรุปต้องแนบผลรันคำสั่งหรือ `ไฟล์:บรรทัด` คำว่า "ทดสอบแล้ว" แปลว่ารันจริงและมี output ส่วนอะไรที่รันไม่ได้จะถูกแยกไว้ให้คุณทดสอบเอง | Evidence, not confidence |
| **ติดลิมิตแล้วไม่เสียงาน** — หัวหน้าสลับโมเดลเอง และสถานะงานอยู่ใน `.crew/state.md` เปิด session ใหม่แล้วพิมพ์ "ทำต่อ" ได้ทันที | Survives rate limits |

---

## ติดตั้ง / Install

> **repo นี้เป็นสาธารณะ (public) และเป็น MIT license** — ใครก็ติดตั้งได้เลย ไม่ต้องมีบัญชี GitHub ไม่ต้องขออนุญาต จะ fork ไปแก้เป็นของตัวเองก็ได้
> *This repo is **public** and MIT-licensed — anyone can install it, no GitHub account or permission needed. Fork it freely.*

พิมพ์ใน **Terminal** (ไม่ใช่ช่องแชท) — run these in a **terminal**, not in the chat box:

```bash
claude plugin marketplace add chivaszxchannel/ai-crew
claude plugin install ai-crew@bm-plugins
```

บรรทัดที่สองไม่ได้พิมพ์ผิดนะครับ — `ai-crew` คือชื่อ **plugin** ส่วน `bm-plugins` คือชื่อ **marketplace** ที่ประกาศไว้ใน `.claude-plugin/marketplace.json` ไม่จำเป็นต้องตรงกับชื่อ repo
*(Not a typo: `ai-crew` is the plugin, `bm-plugins` is the marketplace name declared in `.claude-plugin/marketplace.json`.)*

จากนั้น **รีสตาร์ท Claude Code** แล้วทำ 2 ขั้นนี้ / then restart Claude Code and run:

```
/crew-setup      ครั้งเดียวต่อเครื่อง — ติดตั้ง + login ผู้ตรวจ   (once per machine)
/crew-config     ครั้งเดียวต่อโปรเจกต์ — เลือกโมเดล/โหมด/กติกา   (once per project)
```

> **ไม่มี Codex หรือ Gemini ก็ใช้ได้** ปลั๊กอินจะใช้ Opus เป็นผู้ตรวจแทนอัตโนมัติ และระบุเหตุผลในรายงานทุกครั้ง
> *No Codex or Gemini? It falls back to an Opus reviewer automatically and says so in the report.*

รองรับ Claude Code CLI, extension ใน VS Code / JetBrains, Claude Cowork และ IDE ที่ fork จาก VS Code เช่น Antigravity

---

## ใช้งาน / Usage

| คำสั่ง / Command | ทำอะไร / What it does |
|---|---|
| *พิมพ์งานตามปกติ* | **โหมดอัตโนมัติ** — งานที่ต้องแก้ไฟล์ ทีมรับเอง ส่วนคำถามตอบตรงๆ · *auto mode: the crew starts by itself; questions get direct answers* |
| `/crew <งาน>` | บังคับใช้ทีม + flag: `--eco` `--strict` `--rounds N` `--lang th` |
| `ทำต่อ` / `/crew-resume` | ทำงานค้างต่อหลังสลับโมเดลหรือเปิด session ใหม่ · *resume an in-progress job* |
| `/crew-config` | เปลี่ยนโมเดล / ผู้ตรวจ / โหมด / กติกา แบบกดเลือก · *click-through wizard* |
| `/crew-setup` | ติดตั้งและตรวจ CLI ของผู้ตรวจ · *install & verify reviewer CLIs* |
| *"ไม่ต้องใช้ทีม"* | ข้ามทีมเฉพาะข้อความนั้น · *skip the crew for this message* |

**3 โหมดสำเร็จรูป / three presets**

| โหมด | ใช้เมื่อไหร่ | ทีม |
|---|---|---|
| `eco` | งานเล็ก หรือโควตาใกล้หมด | หัวหน้า Sonnet · ลูกน้อง Haiku · ตรวจ 1 รอบ |
| `normal` | งานทั่วไป (ค่าเริ่มต้น) | หัวหน้า Fable→Opus · Sonnet เขียน · ตรวจ 3 รอบ |
| `strict` | งาน auth / เงิน / ย้ายข้อมูล | Opus เขียน · ผู้ตรวจ 2 ค่ายต้องผ่านทั้งคู่ · 4 รอบ |

---

## ตั้งค่า / Configuration

ค่าทุกอย่างปรับได้ ไม่ต้องแก้โค้ดปลั๊กอิน — ลำดับทับกัน (ล่างชนะบน) / layers, later wins:

`config/defaults.json` → โหมด → `~/.claude/ai-crew.json` → `<project>/.crew/config.json` → flag ตอนสั่ง

```json
{
  "language": "auto",
  "models": {
    "lead":   ["fable", "opus", "inherit"],
    "coder":  ["sonnet", "haiku"],
    "tester": ["sonnet", "haiku"],
    "scout":  ["haiku", "sonnet"],
    "writer": ["haiku", "sonnet"]
  },
  "reviewers": ["codex", "gemini", "opus"],
  "max_rounds": 3,
  "auto_mode": true,
  "git": { "commit": "never" }
}
```

ค่าโมเดลเป็น **รายการสำรอง (fallback chain)** — ลองตัวแรกก่อน ถ้าติดลิมิต/ล่ม ข้ามไปตัวถัดไปเอง และจดไว้ในรายงานว่าสลับตอนไหนเพราะอะไร `inherit` = โมเดลของ session ปัจจุบัน

**กติกาต่อโปรเจกต์ (`.crew/rules.md`)** — ปลั๊กอินเดา stack จากไฟล์ในโปรเจกต์แล้วก็อป template มาให้: PHP บน shared hosting · Next.js + Supabase · Node/Python · generic แก้เองได้ตลอด ทีมจะอ่านทุกครั้งและส่งท่อนกติกาให้ลูกน้องทุกตัว

---

## สิ่งที่ทีมไม่ทำให้เด็ดขาด / What it never does

ไม่ `git commit` · ไม่ push · ไม่ลบไฟล์ · ไม่อัปโหลดขึ้น server · ไม่แตะไฟล์ credential — เว้นแต่คุณสั่งในข้อความนั้นเอง
และ **backup ทุกไฟล์ก่อนแก้** เป็น `<ไฟล์>.bak_YYYYMMDD` พร้อมรักษา line ending และ encoding เดิม

*Never commits, pushes, deletes, deploys, or touches credential files unless you ask in that message. Always backs up before editing.*

---

## เอกสาร / Documentation

| ลิงก์ | เนื้อหา |
|---|---|
| **[INSTALL-TH.md](INSTALL-TH.md)** | **คู่มือติดตั้งและใช้งานภาษาไทยฉบับเต็ม** 11 หัวข้อ — ติดตั้ง 3 วิธี, login ผู้ตรวจ, ตาราง `/crew-config`, ตารางแก้ปัญหา 13 อาการ, ข้อจำกัดที่ควรรู้ |
| [ai-crew/README.md](ai-crew/README.md) | Full English documentation |
| [CHANGELOG.md](CHANGELOG.md) | ประวัติการเปลี่ยนแปลงทุกเวอร์ชัน · changelog |
| [LICENSE](LICENSE) | MIT |

---

## ข้อจำกัดที่ควรรู้ / Known limits

- ปลั๊กอิน **เปลี่ยนโมเดลของ session เองไม่ได้** (Claude Code ไม่เปิดให้ทำ) สิ่งที่สลับอัตโนมัติคือ "สมองหัวหน้า" ที่ถูกเรียกเป็น agent — ถ้าทั้งบัญชีติดลิมิต ทีมจะบันทึกสถานะแล้วบอกให้คุณ `/model` เอง
- **Codex CLI ใช้โควตาร่วมกับแอป Codex** ของบัญชี ChatGPT เดียวกัน · Gemini/Antigravity ใช้โควตาบัญชี Google
- **โหมดอัตโนมัติทำให้งานเล็กช้าลงและเปลืองโควตา** เพราะผ่านทีมและผู้ตรวจ ปรับได้ด้วย `auto_mode_min_files: 2`

---

## ร่วมพัฒนา / Contributing

ยินดีรับ issue และ pull request ทุกแบบ — เพิ่ม template กติกาของ stack ที่คุณใช้, เพิ่มผู้ตรวจเจ้าใหม่, แก้บั๊กของสคริปต์บน OS ที่ผมทดสอบไม่ได้ หรือแค่มาเล่าว่าใช้แล้วเป็นยังไง

*Issues and PRs welcome — new stack rule templates, new reviewer CLIs, fixes for platforms I could not test, or just tell me how it went.*

การแก้ปลั๊กอิน: Claude Code จะก็อปปลั๊กอินที่ติดตั้งแล้วไปไว้ที่ `~/.claude/plugins/cache/<marketplace>/ai-crew/<version>/` ดังนั้นหลังแก้ต้นฉบับต้อง **เพิ่มเลข version** ทั้งใน `ai-crew/.claude-plugin/plugin.json` และ `.claude-plugin/marketplace.json` แล้วรัน `claude plugin update ai-crew@bm-plugins` และรีสตาร์ท ตรวจโครงสร้างด้วย `claude plugin validate ai-crew/.claude-plugin/plugin.json`

---

MIT License · สร้างโดย BM ด้วย Claude · [github.com/chivaszxchannel/ai-crew](https://github.com/chivaszxchannel/ai-crew)
