---
name: crew-image
description: >
  This skill should be used when the user invokes "/crew-image", or asks to "generate an image",
  "make a hero image", "create an icon", "สร้างรูป", "เจนภาพ", "ทำรูป hero", "ทำ og:image", or when a
  crew task needs a picture asset (hero, banner, og:image, placeholder, texture, illustration) that
  does not exist yet. It generates the file with a local CLI that has a built-in image tool
  (Antigravity `agy`), verifies the real pixel size, and reports honestly if it differs.
metadata:
  version: "0.4.0"
---

# /crew-image — generate a picture asset

Optional capability. The crew writes code; this produces the image files a project needs (hero, banner, `og:image`, placeholder photo, texture, illustration, simple icon).

## Before generating

1. **Check the provider is configured.** Read `image.provider` from the merged config (see the crew skill's `references/config-schema.md`). Default `agy`. If `image.provider` is `"none"`, tell the user image generation is turned off and how to enable it (`/crew-config` → image provider), and stop.
2. **Decide the size from the use, not from habit.** Ask only if the user gave no clue: og:image `1200x630`, wide hero `1536x640`, square avatar/icon `512x512`, mobile banner `1080x1350`. State the size you chose in your reply.
3. **Decide where it goes.** Default `image.out_dir` (`assets/generated/`), filename in kebab-case describing the subject (`hero-fishing-pond.png`). Never overwrite an existing file without saying so — the tool backs one up as `.bak_YYYYMMDD` automatically.

## Generate

```
node "${CLAUDE_PLUGIN_ROOT}/tools/gen-image.mjs" --json \
  --prompt "<a full visual description: subject, composition, lighting, colour, style, mood>" \
  --out "<project>/assets/generated/<name>.png" \
  --width <W> --height <H>
```

Repeat `--ref <path>` for reference images when a series must look consistent. `--provider` overrides the configured provider; `--timeout 12m` changes the limit.

Write a real brief in `--prompt`. "รูปบ่อตกปลา" produces generic stock; "a calm freshwater fishing pond at golden hour, low camera angle across the water, reeds in the foreground, warm side light, soft haze, photographic, no people, no text" produces something usable. Say what must NOT be in it (text, watermark, people) — models add text badly.

## Read the result — this is the part that matters

The tool prints JSON and its exit code is the verdict:

| exit | meaning | what to do |
|---|---|---|
| 0 | file written and the size matches (or none was requested) | report the path and the real size from `actual` |
| 1 | file written but `actual` ≠ `requested`, and no ffmpeg/ImageMagick was available to crop | **say the real size.** Never report the requested size. Offer: accept it, install ffmpeg, or retry |
| 2 | provider not installed / not signed in / rate-limited | report the exact reason from `error`; do not silently switch to another approach |
| 3 | nothing was produced | show `log` from the JSON; do not retry more than once |

Never state a size, a format, or a success you did not read out of that JSON. `actual` is measured from the file header, `requested` is only what was asked for.

## Always tell the user it is AI-generated

Say so in the reply and, inside a `/crew` run, in the report's changed-files list (e.g. `assets/generated/hero.png — AI-generated image, 1536x640`). Users need this to decide about licensing, alt text and accuracy.

## Never generate

- Real, identifiable people (public figures, the user's customers, staff photos)
- Company logos, trademarks, brand marks, or a redraw of an existing logo
- Copyrighted characters, or a specific existing artwork/poster/album cover
- Screenshots or documents that could be mistaken for real records (receipts, invoices, IDs, bank screens)
- Anything meant to pass as a real photograph of a real event or place

If the user asks for one of these, say what you cannot do in one sentence and offer the honest alternative: an original invented design, a generic subject, a labelled placeholder, or their own real photo.

## Inside a /crew run

The lead may assign an image subtask when the plan needs an asset that does not exist. Rules:
- The asset is a **deliverable file** — it goes in the changed-files list with its real size and the AI-generated note.
- The prompt used must be recorded in `state.md` so the image can be regenerated or adjusted later.
- If exit is 1 or 2, that subtask is **not** `done`. Report it as an open item; never let the page ship with a wrong-size or missing asset silently.
- Generating an image is never a reason to skip the review round for the code that uses it.

## Known limits (say these rather than discovering them silently)

- The provider defaults to a 1024x1024 square and honours aspect-ratio wording inconsistently, which is why `--width/--height` are passed explicitly and the result is measured.
- Cropping to an exact size needs `ffmpeg` or `magick` on the machine. Without either, the tool reports the mismatch instead of faking it.
- Image generation uses the same Antigravity/Gemini account quota as the reviewer. Heavy image use can rate-limit the reviewer chain; if that happens the crew falls back to the agent reviewer and says so.
- Text inside generated images is usually wrong. Put real text in HTML/CSS over the image instead.
