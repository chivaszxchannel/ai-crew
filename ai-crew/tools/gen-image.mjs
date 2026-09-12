#!/usr/bin/env node
/*
 * ai-crew image generator — optional. Generates an image asset with a local CLI
 * that has a built-in image tool, and VERIFIES the result instead of assuming it.
 *
 *   node tools/gen-image.mjs --prompt "..." --out assets/hero.png [--width 1536 --height 640]
 *                            [--ref face.png ...] [--provider agy] [--timeout 12m] [--json]
 *
 * Provider `agy` (Antigravity CLI): runs
 *     agy --print-timeout <t> --add-dir <outdir> --print "<instructions>"
 * asking it to use its own built-in image tool and write the file to --out.
 * stdin is closed because `agy --print` writes nothing to a redirected stdout otherwise
 * (antigravity-cli issue #76), and AI_CREW_IMAGE_DEPTH guards against agy calling itself.
 *
 * It then reads the real pixel size from the file header. If the size is wrong it says so;
 * it only crops when ffmpeg or ImageMagick is present, and it never claims a size it did not measure.
 *
 * Exit codes: 0 ok (size matched, or no size requested) · 1 generated but size differs
 *             2 provider unavailable · 3 failed to generate
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const A = process.argv.slice(2);
const get = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : d; };
const all = (n) => A.reduce((a, v, i) => (v === n && A[i + 1] ? [...a, A[i + 1]] : a), []);
const has = (n) => A.includes(n);

const PROMPT = get('--prompt');
const OUT = get('--out');
const W = Number(get('--width', 0)) || 0;
const H = Number(get('--height', 0)) || 0;
const REFS = all('--ref');
const PROVIDER = get('--provider', 'agy');
const TIMEOUT = get('--timeout', '12m');
const AS_JSON = has('--json');

const say = (o) => { if (AS_JSON) console.log(JSON.stringify(o, null, 2)); else {
  for (const [k, v] of Object.entries(o)) console.log(`${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
} };
const die = (code, o) => { say({ ok: false, ...o }); process.exit(code); };

if (!PROMPT || !OUT) die(3, { error: 'ต้องมี --prompt และ --out / --prompt and --out are required' });
if (process.env.AI_CREW_IMAGE_DEPTH) die(3, { error: 'recursion guard: gen-image ถูกเรียกซ้อนตัวเอง' });

const outAbs = path.resolve(OUT);
fs.mkdirSync(path.dirname(outAbs), { recursive: true });
if (fs.existsSync(outAbs)) {
  const d = new Date(); const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const bak = `${outAbs}.bak_${stamp}`; if (!fs.existsSync(bak)) fs.copyFileSync(outAbs, bak);
}

/** Read real pixel size from the file header. No dependencies, no guessing. */
function imageSize(file) {
  const b = fs.readFileSync(file);
  if (b.length > 24 && b.toString('hex', 0, 8) === '89504e470d0a1a0a')          // PNG
    return { format: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {                          // JPEG
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m))
        return { format: 'jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    if (b.toString('ascii', 12, 16) === 'VP8X') return { format: 'webp', width: (b.readUIntLE(24, 3) & 0xffffff) + 1, height: (b.readUIntLE(27, 3) & 0xffffff) + 1 };
  }
  return { format: 'unknown', width: 0, height: 0 };
}

const which = (bin) => { const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8', windowsHide: true }); return r.status === 0; };

const PROVIDERS = {
  agy: {
    bin: 'agy',
    install: 'ติดตั้ง Antigravity CLI แล้วรัน agy หนึ่งครั้งเพื่อ sign in / install the Antigravity CLI, then run agy once to sign in',
    build(instructions) {
      const a = ['--print-timeout', TIMEOUT, '--add-dir', path.dirname(outAbs)];
      for (const r of REFS) a.push('--add-dir', path.dirname(path.resolve(r)));
      a.push('--print', instructions);
      return a;
    },
  },
};

const p = PROVIDERS[PROVIDER];
if (!p) die(3, { error: `ไม่รู้จัก provider "${PROVIDER}" · known: ${Object.keys(PROVIDERS).join(', ')}` });
if (!which(p.bin)) die(2, { error: `ไม่พบคำสั่ง ${p.bin}`, hint: p.install });

// ---- instructions sent to the CLI agent -------------------------------------
const sizeLine = W && H
  ? `The image MUST be exactly ${W} x ${H} pixels. Do not output a square unless ${W} equals ${H}. Aspect-ratio words are not enough — set the pixel size explicitly.`
  : `Use a sensible size for the subject.`;
const refLine = REFS.length
  ? `Reference images to keep visual consistency with: ${REFS.map((r) => path.resolve(r)).join(', ')}. Read them first.`
  : '';
const instructions = [
  `Use your built-in image generation tool to create one image and save it to this exact path: ${outAbs}`,
  sizeLine,
  refLine,
  `Do not run shell commands. Do not call yourself. Do not write any other file.`,
  `Do not depict real, identifiable people, real company logos, trademarks, or copyrighted characters.`,
  `Subject: ${PROMPT}`,
].filter(Boolean).join('\n\n');

const args = p.build(instructions);
const started = Date.now();
const r = spawnSync(p.bin, args, {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],          // stdin closed on purpose — see header note
  env: { ...process.env, AI_CREW_IMAGE_DEPTH: '1' },
  windowsHide: true,
  shell: process.platform === 'win32',
});
const log = `${r.stdout || ''}\n${r.stderr || ''}`.trim();
const lower = log.toLowerCase();
if (/rate limit|usage limit|quota|too many requests|429|resource_exhausted/.test(lower))
  die(2, { error: 'โควตาหมดชั่วคราว / provider rate-limited', provider: PROVIDER, log: log.slice(0, 400) });
if (/not logged in|login required|unauthorized|401|please sign in/.test(lower))
  die(2, { error: 'ยังไม่ได้ login / not signed in', provider: PROVIDER, hint: `รัน ${p.bin} หนึ่งครั้งเพื่อ sign in`, log: log.slice(0, 400) });

if (!fs.existsSync(outAbs))
  die(3, { error: 'ไม่ได้ไฟล์ออกมา / no file produced', provider: PROVIDER, exitCode: r.status, log: log.slice(0, 800) });

let size = imageSize(outAbs);
let cropped = false;
if (W && H && (size.width !== W || size.height !== H)) {
  const tool = which('ffmpeg') ? 'ffmpeg' : which('magick') ? 'magick' : null;
  if (tool === 'ffmpeg') {
    const tmp = path.join(os.tmpdir(), `crew-img-${Date.now()}.png`);
    const c = spawnSync('ffmpeg', ['-y', '-i', outAbs, '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`, tmp], { encoding: 'utf8', windowsHide: true });
    if (c.status === 0 && fs.existsSync(tmp)) { fs.copyFileSync(tmp, outAbs); fs.unlinkSync(tmp); cropped = true; size = imageSize(outAbs); }
  } else if (tool === 'magick') {
    const c = spawnSync('magick', [outAbs, '-resize', `${W}x${H}^`, '-gravity', 'center', '-extent', `${W}x${H}`, outAbs], { encoding: 'utf8', windowsHide: true });
    if (c.status === 0) { cropped = true; size = imageSize(outAbs); }
  }
}

const matched = !W || !H || (size.width === W && size.height === H);
say({
  ok: true, file: outAbs, provider: PROVIDER,
  requested: W && H ? `${W}x${H}` : 'ไม่ระบุ / not specified',
  actual: `${size.width}x${size.height}`, format: size.format,
  matched, cropped,
  note: matched ? 'ภาพนี้สร้างด้วย AI — ระบุให้ผู้ใช้ทราบเสมอ / AI-generated: always disclose'
    : 'ขนาดไม่ตรงที่ขอ และไม่มี ffmpeg/ImageMagick ให้ crop — แจ้งผู้ใช้ อย่าอ้างว่าได้ขนาดที่ขอ',
  seconds: Math.round((Date.now() - started) / 1000),
});
process.exit(matched ? 0 : 1);
