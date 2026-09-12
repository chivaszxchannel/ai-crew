#!/usr/bin/env node
/*
 * ai-crew config UI — a local, single-file settings page.
 *
 *   node tools/config-ui.mjs [--project <dir>] [--port 0] [--no-open]
 *
 * Opens a page in your browser where you pick models, mode, reviewers, rounds,
 * language and the project rules template, then writes .crew/config.json or
 * ~/.claude/ai-crew.json.
 *
 * Security: binds 127.0.0.1 only, requires a one-time token generated at start
 * (it is in the URL that opens), rejects cross-origin requests, and shuts itself
 * down after 30 minutes idle. It never asks for, sees, or stores any password or
 * token: "Login" launches the vendor's own CLI in a new terminal window and the
 * vendor handles the browser sign-in.
 *
 * No npm dependencies. Node 18+.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn, execFile } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, '..');
const HOME = os.homedir();
const TOKEN = crypto.randomBytes(24).toString('hex');
const IDLE_MS = 30 * 60 * 1000;

const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const PROJECT = path.resolve(argOf('--project', process.cwd()));
const PORT = Number(argOf('--port', '0'));
const NO_OPEN = argv.includes('--no-open');

const MODELS = ['fable', 'opus', 'sonnet', 'haiku', 'inherit'];
const ROLES = [
  ['lead', 'หัวหน้า — วางแผน คัดกรองผลตรวจ เขียนรายงาน', 'Lead — plans, triages, reports'],
  ['coder', 'เขียนโค้ด', 'Coder'],
  ['tester', 'ทดสอบ / พิสูจน์', 'Tester'],
  ['scout', 'หาไฟล์ / อ่านโครงสร้าง', 'Scout'],
  ['writer', 'เอกสาร / คำขอตรวจ', 'Writer'],
];
const CLI_REVIEWERS = {
  codex:       { bin: 'codex',  label: 'Codex CLI (OpenAI)',      install: 'npm install -g @openai/codex',     login: 'codex login',  status: [['login', 'status']] },
  gemini:      { bin: 'gemini', label: 'Gemini CLI (Google)',     install: 'npm install -g @google/gemini-cli', login: 'gemini',       status: [] },
  antigravity: { bin: 'agy',    label: 'Antigravity CLI (Google)', install: null,                               login: 'agy',          status: [] },
};
const AGENT_REVIEWERS = { opus: 'Opus agent (ในตัว)', sonnet: 'Sonnet agent (ในตัว)', fable: 'Fable agent (ในตัว)' };

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const stripMeta = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !k.startsWith('$')));

function mergedConfig() {
  const defaults = stripMeta(readJson(path.join(PLUGIN_ROOT, 'config/defaults.json')) || {});
  const modes = readJson(path.join(PLUGIN_ROOT, 'config/modes.json')) || {};
  const user = stripMeta(readJson(path.join(HOME, '.claude/ai-crew.json')) || {});
  const proj = stripMeta(readJson(path.join(PROJECT, '.crew/config.json')) || {});
  const mode = proj.mode || user.mode || defaults.mode || 'normal';
  const out = {};
  for (const layer of [defaults, stripMeta(modes[mode] || {}), user, proj]) {
    for (const [k, v] of Object.entries(layer)) {
      if (k === 'models') out.models = { ...(out.models || {}), ...v };
      else if (k === 'description') continue;
      else out[k] = v;
    }
  }
  out.mode = mode;
  return { merged: out, modes, hasUser: !!readJson(path.join(HOME, '.claude/ai-crew.json')), hasProject: !!readJson(path.join(PROJECT, '.crew/config.json')) };
}

function run(cmd, args, timeout = 6000) {
  return new Promise((res) => {
    execFile(cmd, args, { timeout, windowsHide: true, shell: process.platform === 'win32' }, (err, so, se) =>
      res({ ok: !err, out: String(so || '') + String(se || ''), code: err ? (err.code ?? 1) : 0 }));
  });
}

async function cliStatus(key) {
  const c = CLI_REVIEWERS[key];
  const v = await run(c.bin, ['--version']);
  if (!v.ok) return { installed: false, login: 'missing', detail: 'ยังไม่ได้ติดตั้ง / not installed' };
  const version = (v.out.trim().split('\n')[0] || '').slice(0, 60);
  for (const st of c.status) {
    const r = await run(c.bin, st);
    if (r.ok) {
      const t = r.out.toLowerCase();
      if (/not logged in|logged out|no credentials|unauthenticated|please (log|sign) in/.test(t))
        return { installed: true, login: 'out', version, detail: 'ยังไม่ได้ login' };
      return { installed: true, login: 'in', version, detail: r.out.trim().split('\n')[0].slice(0, 80) };
    }
  }
  return { installed: true, login: 'unknown', version, detail: 'ติดตั้งแล้ว · ตรวจสถานะ login อัตโนมัติไม่ได้' };
}

/** Open a real terminal window running `cmd`, so the user can complete an interactive sign-in. */
function openTerminal(cmdline, title) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aicrew-'));
  try {
    if (process.platform === 'win32') {
      const bat = path.join(dir, 'run.bat');
      fs.writeFileSync(bat, `@echo off\r\ntitle ${title}\r\necho ${title}\r\necho.\r\n${cmdline}\r\necho.\r\necho ---\r\necho เสร็จแล้วปิดหน้าต่างนี้ แล้วกด "ตรวจสถานะอีกครั้ง" ในหน้าเว็บ\r\npause\r\n`);
      spawn('cmd', ['/c', 'start', '""', bat], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
      return { ok: true, how: 'เปิดหน้าต่าง Command Prompt ให้แล้ว' };
    }
    if (process.platform === 'darwin') {
      const sh = path.join(dir, 'run.command');
      fs.writeFileSync(sh, `#!/bin/bash\necho "${title}"\n${cmdline}\necho\nread -p "Press enter to close"\n`, { mode: 0o755 });
      spawn('open', ['-a', 'Terminal', sh], { detached: true, stdio: 'ignore' }).unref();
      return { ok: true, how: 'เปิด Terminal ให้แล้ว' };
    }
    const sh = path.join(dir, 'run.sh');
    fs.writeFileSync(sh, `#!/bin/bash\necho "${title}"\n${cmdline}\necho\nread -p "Press enter to close"\n`, { mode: 0o755 });
    for (const t of ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xterm']) {
      try { spawn(t, ['-e', 'bash', sh], { detached: true, stdio: 'ignore' }).unref(); return { ok: true, how: `เปิด ${t} ให้แล้ว` }; } catch {}
    }
    return { ok: false, how: 'เปิด terminal อัตโนมัติไม่ได้ กรุณารันคำสั่งนี้เอง', cmd: cmdline };
  } catch (e) {
    return { ok: false, how: 'เปิด terminal ไม่สำเร็จ กรุณารันคำสั่งนี้เอง: ' + e.message, cmd: cmdline };
  }
}

function ruleTemplates() {
  const dir = path.join(PLUGIN_ROOT, 'templates/rules');
  try { return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')); } catch { return []; }
}

function detectStack() {
  const has = (p) => fs.existsSync(path.join(PROJECT, p));
  const glob = (re) => { try { return fs.readdirSync(PROJECT).some((f) => re.test(f)); } catch { return false; } };
  if (has('composer.json') || glob(/\.php$/)) return 'php-hostinger';
  if (glob(/^next\.config\./) && has('supabase')) return 'nextjs-supabase';
  if (has('package.json') || has('pyproject.toml')) return 'node-python-generic';
  return 'generic';
}

function backupThenWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const bak = `${file}.bak_${stamp}`;
    if (!fs.existsSync(bak)) fs.copyFileSync(file, bak);
  }
  fs.writeFileSync(file, content, 'utf8');
}

function ensureGitignore() {
  const gi = path.join(PROJECT, '.gitignore');
  if (!fs.existsSync(gi)) return false;
  const t = fs.readFileSync(gi, 'utf8');
  if (/^\.crew\/?\s*$/m.test(t)) return false;
  fs.appendFileSync(gi, (t.endsWith('\n') ? '' : '\n') + '.crew/\n');
  return true;
}

// ----------------------------------------------------------------- server
let idleTimer;
const bumpIdle = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => { console.log('\n[ai-crew] ปิดเซิร์ฟเวอร์เพราะไม่มีการใช้งาน 30 นาที'); process.exit(0); }, IDLE_MS); };

const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  bumpIdle();
  const url = new URL(req.url, 'http://127.0.0.1');
  // --- origin / token guard: only our own page may call the API
  const host = req.headers.host || '';
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return json(res, 403, { error: 'bad host' });
  const origin = req.headers.origin;
  if (origin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) return json(res, 403, { error: 'bad origin' });
  const tok = url.searchParams.get('t') || req.headers['x-token'];
  if (tok !== TOKEN) return json(res, 403, { error: 'bad token' });

  if (url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }

  if (url.pathname === '/api/state') {
    const { merged, modes, hasUser, hasProject } = mergedConfig();
    const cli = {};
    for (const k of Object.keys(CLI_REVIEWERS)) cli[k] = { ...(await cliStatus(k)), label: CLI_REVIEWERS[k].label, canInstall: !!CLI_REVIEWERS[k].install };
    return json(res, 200, {
      merged, modes: Object.fromEntries(Object.entries(modes).filter(([k]) => !k.startsWith('$'))),
      cli, agents: AGENT_REVIEWERS, models: MODELS, roles: ROLES,
      templates: ruleTemplates(), detected: detectStack(),
      project: PROJECT, home: HOME, hasUser, hasProject,
      rulesExists: fs.existsSync(path.join(PROJECT, '.crew/rules.md')),
      platform: process.platform,
    });
  }

  if (req.method === 'POST') {
    const body = await new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b)); });
    let data = {}; try { data = JSON.parse(body || '{}'); } catch {}

    if (url.pathname === '/api/login') {
      const c = CLI_REVIEWERS[data.cli]; if (!c) return json(res, 400, { error: 'unknown cli' });
      return json(res, 200, openTerminal(c.login, `ai-crew — login ${data.cli}`));
    }
    if (url.pathname === '/api/install') {
      const c = CLI_REVIEWERS[data.cli]; if (!c || !c.install) return json(res, 400, { error: 'no installer for this cli' });
      return json(res, 200, openTerminal(c.install, `ai-crew — install ${data.cli}`));
    }
    if (url.pathname === '/api/save') {
      try {
        const cfg = data.config || {};
        const scope = data.scope === 'global' ? 'global' : 'project';
        const target = scope === 'global' ? path.join(HOME, '.claude/ai-crew.json') : path.join(PROJECT, '.crew/config.json');
        backupThenWrite(target, JSON.stringify(cfg, null, 2) + '\n');
        const written = [target];
        if (data.rulesTemplate) {
          const src = path.join(PLUGIN_ROOT, 'templates/rules', data.rulesTemplate + '.md');
          const dst = path.join(PROJECT, cfg.rules_file || '.crew/rules.md');
          if (fs.existsSync(src) && (!fs.existsSync(dst) || data.overwriteRules)) { backupThenWrite(dst, fs.readFileSync(src, 'utf8')); written.push(dst); }
        }
        const gi = scope === 'project' ? ensureGitignore() : false;
        return json(res, 200, { ok: true, written, gitignore: gi });
      } catch (e) { return json(res, 500, { error: e.message }); }
    }
    if (url.pathname === '/api/quit') { json(res, 200, { ok: true }); setTimeout(() => process.exit(0), 200); return; }
  }
  return json(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  const { port } = server.address();
  const link = `http://127.0.0.1:${port}/?t=${TOKEN}`;
  console.log('\n  ai-crew config UI');
  console.log('  ' + link);
  console.log('\n  โปรเจกต์: ' + PROJECT);
  console.log('  ปิดด้วย Ctrl+C (หรือปล่อยไว้ 30 นาทีแล้วปิดเอง)\n');
  if (!NO_OPEN) {
    const opener = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', link]]
      : process.platform === 'darwin' ? ['open', [link]] : ['xdg-open', [link]];
    try { spawn(opener[0], opener[1], { detached: true, stdio: 'ignore' }).unref(); } catch {}
  }
  bumpIdle();
});

// ----------------------------------------------------------------- page
const PAGE = String.raw`<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>ai-crew — ตั้งค่า</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--ink:#1a1d21;--muted:#6b7280;--line:#e3e6ea;--accent:#c8623a;--ok:#177245;--warn:#9a6700;--bad:#a8321f;--radius:12px}
@media(prefers-color-scheme:dark){:root{--bg:#14161a;--card:#1c1f24;--ink:#e8eaed;--muted:#9aa1ab;--line:#2b2f36;--accent:#e2794d;--ok:#4cae7a;--warn:#d4a53a;--bad:#e0705c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai",sans-serif}
.wrap{max-width:920px;margin:0 auto;padding:24px 16px 96px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:0 0 12px}
.sub{color:var(--muted);font-size:13px;margin-bottom:20px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:18px;margin-bottom:16px}
.row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:9px 0;border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:0}.row .lbl{flex:1 1 240px;min-width:200px}
.row .lbl small{display:block;color:var(--muted);font-size:12px;line-height:1.4}
select,input[type=number]{background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:7px 10px;font:inherit;font-size:14px;min-width:110px}
select:focus,input:focus{outline:2px solid var(--accent);outline-offset:1px}
button{background:var(--accent);color:#fff;border:0;border-radius:8px;padding:8px 14px;font:inherit;font-size:14px;cursor:pointer}
button.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
button:disabled{opacity:.45;cursor:not-allowed}
.modes{display:flex;gap:10px;flex-wrap:wrap}
.mode{flex:1 1 200px;border:2px solid var(--line);border-radius:var(--radius);padding:12px;cursor:pointer;background:transparent;color:var(--ink);text-align:left;display:block}
.mode.on{border-color:var(--accent)}.mode b{display:block;margin-bottom:3px}.mode span{color:var(--muted);font-size:12.5px;line-height:1.45}
.badge{font-size:12px;padding:3px 9px;border-radius:99px;border:1px solid var(--line);white-space:nowrap}
.badge.ok{color:var(--ok);border-color:var(--ok)}.badge.warn{color:var(--warn);border-color:var(--warn)}.badge.bad{color:var(--bad);border-color:var(--bad)}
.chain{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.arrow{color:var(--muted);font-size:13px}
.bar{position:fixed;left:0;right:0;bottom:0;background:var(--card);border-top:1px solid var(--line);padding:12px 16px;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap}
.msg{font-size:13px;color:var(--muted)}.msg.good{color:var(--ok)}.msg.bad{color:var(--bad)}
code{background:var(--bg);border:1px solid var(--line);border-radius:5px;padding:1px 6px;font-size:13px}
.rev{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid var(--line)}
.rev:last-child{border-bottom:0}.rev .n{flex:1 1 230px}
.ord{width:34px;text-align:center;color:var(--muted);font-variant-numeric:tabular-nums}
</style></head><body><div class="wrap">
<h1>ai-crew — ตั้งค่า / Settings</h1>
<div class="sub" id="where"></div>
<div id="app">กำลังโหลด…</div>
</div>
<div class="bar">
  <span class="msg" id="msg"></span>
  <button class="ghost" onclick="location.reload()">ตรวจสถานะอีกครั้ง</button>
  <button id="save" onclick="save()">บันทึก</button>
  <button class="ghost" onclick="quit()">ปิดโปรแกรม</button>
</div>
<script>
const T=new URLSearchParams(location.search).get('t');
const api=(p,b)=>fetch(p+'?t='+T,b?{method:'POST',headers:{'content-type':'application/json','x-token':T},body:JSON.stringify(b)}:{headers:{'x-token':T}}).then(r=>r.json());
let S=null,cfg=null,scope='project',tpl=null;
const el=(h)=>{const d=document.createElement('div');d.innerHTML=h.trim();return d.firstChild};
const msg=(t,c='')=>{const m=document.getElementById('msg');m.textContent=t;m.className='msg '+c};

function chainSel(role){
  const cur=(cfg.models&&cfg.models[role])||[];
  return [0,1,2].map(i=>{
    const opts=['<option value="">—</option>'].concat(S.models.map(m=>'<option value="'+m+'"'+(cur[i]===m?' selected':'')+'>'+m+'</option>')).join('');
    return '<select data-role="'+role+'" data-i="'+i+'">'+opts+'</select>'+(i<2?'<span class="arrow">→</span>':'');
  }).join('');
}
function revRow(key,label,type,idx,total){
  const st=type==='cli'?S.cli[key]:null;
  let b='<span class="badge ok">พร้อมใช้</span>';
  if(st){ if(!st.installed) b='<span class="badge bad">ยังไม่ติดตั้ง</span>';
    else if(st.login==='out') b='<span class="badge warn">ยังไม่ login</span>';
    else if(st.login==='unknown') b='<span class="badge warn">ติดตั้งแล้ว · สถานะ login ไม่ทราบ</span>';
    else b='<span class="badge ok">พร้อมใช้</span>'; }
  const on=cfg.reviewers.includes(key);
  const btns=st?((!st.installed&&st.canInstall?'<button class="ghost" onclick="doInstall(\''+key+'\')">ติดตั้ง</button>':'')
    +(st.installed?'<button class="ghost" onclick="doLogin(\''+key+'\')">Login</button>':''))
    :'';
  return '<div class="rev"><span class="ord">'+(on?(idx+1):'–')+'</span>'
    +'<label class="n"><input type="checkbox" data-rev="'+key+'" '+(on?'checked':'')+'> '+label+'</label>'
    +b+'<span style="flex:1"></span>'
    +'<button class="ghost" onclick="moveRev(\''+key+'\',-1)" '+(!on||idx<=0?'disabled':'')+'>↑</button>'
    +'<button class="ghost" onclick="moveRev(\''+key+'\',1)" '+(!on||idx<0||idx>=total-1?'disabled':'')+'>↓</button>'
    +btns+'</div>';
}
function render(){
  document.getElementById('where').innerHTML='โปรเจกต์: <code>'+S.project+'</code>';
  const modeCards=Object.entries(S.modes).map(([k,v])=>
    '<button class="mode'+(cfg.mode===k?' on':'')+'" onclick="setMode(\''+k+'\')"><b>'+k+'</b><span>'+(v.description||'')+'</span></button>').join('');
  const roleRows=S.roles.map(([r,th,en])=>
    '<div class="row"><div class="lbl">'+th+'<small>'+en+'</small></div><div class="chain">'+chainSel(r)+'</div></div>').join('');
  const revs=cfg.reviewers.filter(k=>S.cli[k]||S.agents[k]);
  const all=[...Object.keys(S.cli).map(k=>[k,S.cli[k].label,'cli']),...Object.entries(S.agents).map(([k,l])=>[k,l,'agent'])];
  const revRows=all.map(([k,l,t])=>revRow(k,l,t,revs.indexOf(k),revs.length)).join('');
  const tplOpts=S.templates.map(t=>'<option value="'+t+'"'+((tpl||S.detected)===t?' selected':'')+'>'+t+(t===S.detected?' (ตรวจเจอในโปรเจกต์นี้)':'')+'</option>').join('');

  document.getElementById('app').innerHTML=
  '<div class="card"><h2>1. บันทึกไว้ที่ไหน / Scope</h2>'
  +'<div class="row"><div class="lbl">ขอบเขตของค่าที่บันทึก<small>project = เฉพาะโปรเจกต์นี้ · global = ทุกโปรเจกต์ในเครื่อง</small></div>'
  +'<select id="scope"><option value="project"'+(scope==='project'?' selected':'')+'>โปรเจกต์นี้ (.crew/config.json)</option>'
  +'<option value="global"'+(scope==='global'?' selected':'')+'>ทุกโปรเจกต์ (~/.claude/ai-crew.json)</option></select></div></div>'

  +'<div class="card"><h2>2. โหมด / Mode</h2><div class="modes">'+modeCards+'</div>'
  +'<div class="sub" style="margin:12px 0 0">กดโหมดแล้วช่องโมเดลด้านล่างจะเปลี่ยนตาม ปรับเองต่อได้</div></div>'

  +'<div class="card"><h2>3. โมเดลแต่ละบทบาท / Models per role</h2>'
  +'<div class="sub" style="margin:-4px 0 8px">เรียงเป็นสายสำรอง ตัวแรกก่อน ถ้าติดลิมิตหรือล่มจะข้ามไปตัวถัดไปเอง · <code>inherit</code> = โมเดลของ session</div>'
  +roleRows+'</div>'

  +'<div class="card"><h2>4. ผู้ตรวจ / Reviewers</h2>'
  +'<div class="sub" style="margin:-4px 0 8px">ติ๊กเลือกและเรียงลำดับ ระบบใช้ตัวแรกที่พร้อม · ปุ่ม Login จะเปิดหน้าต่าง terminal ให้ login กับเจ้าของ CLI โดยตรง โปรแกรมนี้ไม่เห็นรหัสหรือ token</div>'
  +revRows+'</div>'

  +'<div class="card"><h2>5. อื่นๆ / Options</h2>'
  +'<div class="row"><div class="lbl">จำนวนรอบตรวจสูงสุด<small>Max review rounds</small></div><input type="number" id="rounds" min="1" max="99" value="'+(cfg.max_rounds||3)+'"></div>'
  +'<div class="row"><div class="lbl">ภาษาที่ตอบ<small>Reply language</small></div><select id="lang">'
  +['auto','th','en'].map(l=>'<option value="'+l+'"'+((cfg.language||'auto')===l?' selected':'')+'>'+(l==='auto'?'อัตโนมัติ ตามภาษาที่พิมพ์':l==='th'?'ไทย':'English')+'</option>').join('')+'</select></div>'
  +'<div class="row"><div class="lbl">โหมดอัตโนมัติ<small>เริ่มทีมเองโดยไม่ต้องพิมพ์ /crew</small></div><select id="auto">'
  +'<option value="1">เปิด — ทุกงานที่แก้ไฟล์</option><option value="2">เปิด — เฉพาะงานที่แตะ 2 ไฟล์ขึ้นไป</option><option value="0">ปิด — ต้องพิมพ์ /crew เอง</option></select></div>'
  +'<div class="row"><div class="lbl">Git<small>ทีมจะ commit ให้หรือไม่</small></div><select id="git">'
  +[['never','ไม่ commit เลย ฉันทำเอง'],['ask','เสนอข้อความแล้วถามก่อน'],['auto','commit เองหลังตรวจผ่าน']].map(([v,l])=>'<option value="'+v+'"'+(((cfg.git&&cfg.git.commit)||'never')===v?' selected':'')+'>'+l+'</option>').join('')+'</select></div></div>'

  +'<div class="card"><h2>6. กติกาของโปรเจกต์ / Project rules</h2>'
  +'<div class="sub" style="margin:-4px 0 8px">ไฟล์ <code>.crew/rules.md</code> คือสิ่งที่ทำให้ทีมรู้จักโปรเจกต์นี้ (คำสั่งตรวจ syntax, วิธี deploy, ไฟล์ห้ามแตะ)'
  +(S.rulesExists?' — <b>มีไฟล์อยู่แล้ว</b> จะไม่เขียนทับถ้าไม่ติ๊ก':'')+'</div>'
  +'<div class="row"><div class="lbl">เลือก template</div><select id="tpl"><option value="">— ไม่ต้องสร้าง —</option>'+tplOpts+'</select></div>'
  +(S.rulesExists?'<div class="row"><div class="lbl">เขียนทับไฟล์เดิม<small>จะ backup ให้ก่อนเป็น .bak_YYYYMMDD</small></div><input type="checkbox" id="ow"></div>':'')
  +'</div>';

  document.getElementById('scope').onchange=e=>{scope=e.target.value};
  document.getElementById('tpl').onchange=e=>{tpl=e.target.value};
  document.querySelectorAll('select[data-role]').forEach(s=>s.onchange=()=>{
    const r=s.dataset.role;const arr=[0,1,2].map(i=>document.querySelector('select[data-role="'+r+'"][data-i="'+i+'"]').value).filter(Boolean);
    cfg.models[r]=[...new Set(arr)];
  });
  document.querySelectorAll('input[data-rev]').forEach(c=>c.onchange=()=>{
    const k=c.dataset.rev;
    if(c.checked){ if(!cfg.reviewers.includes(k)) cfg.reviewers.push(k); } else cfg.reviewers=cfg.reviewers.filter(x=>x!==k);
    render();
  });
}
function setMode(m){ cfg.mode=m; const p=S.modes[m]||{};
  if(p.models) cfg.models={...cfg.models,...p.models};
  if(p.max_rounds) cfg.max_rounds=p.max_rounds;
  render(); msg('เปลี่ยนเป็นโหมด '+m+' แล้ว ยังไม่ได้บันทึก');
}
function moveRev(k,d){ const i=cfg.reviewers.indexOf(k); if(i<0) return; const j=i+d; if(j<0||j>=cfg.reviewers.length) return;
  [cfg.reviewers[i],cfg.reviewers[j]]=[cfg.reviewers[j],cfg.reviewers[i]]; render(); }
async function doLogin(k){ msg('กำลังเปิดหน้าต่าง login…'); const r=await api('/api/login',{cli:k});
  msg(r.ok?(r.how+' — ทำใน terminal ให้เสร็จ แล้วกด "ตรวจสถานะอีกครั้ง"'):(r.how+' '+(r.cmd||'')),r.ok?'good':'bad'); }
async function doInstall(k){ msg('กำลังเปิดหน้าต่างติดตั้ง…'); const r=await api('/api/install',{cli:k});
  msg(r.ok?(r.how+' — รอให้ติดตั้งเสร็จ แล้วกด "ตรวจสถานะอีกครั้ง"'):(r.how+' '+(r.cmd||'')),r.ok?'good':'bad'); }
async function save(){
  const out={language:document.getElementById('lang').value,mode:cfg.mode,models:cfg.models,
    reviewers:cfg.reviewers,max_rounds:Number(document.getElementById('rounds').value)||3};
  const a=document.getElementById('auto').value;
  out.auto_mode=a!=='0'; if(a==='2') out.auto_mode_min_files=2; else if(a==='1') out.auto_mode_min_files=1;
  out.git={commit:document.getElementById('git').value};
  if(scope==='project') out.rules_file='.crew/rules.md';
  const owEl=document.getElementById('ow');
  const r=await api('/api/save',{config:out,scope,rulesTemplate:document.getElementById('tpl').value||null,overwriteRules:owEl?owEl.checked:false});
  if(r.error) return msg('บันทึกไม่สำเร็จ: '+r.error,'bad');
  msg('บันทึกแล้ว: '+r.written.join(' , ')+(r.gitignore?' · เพิ่ม .crew/ ใน .gitignore ให้แล้ว':''),'good');
}
async function quit(){ await api('/api/quit',{}); document.body.innerHTML='<div class="wrap"><h1>ปิดแล้ว</h1><p class="sub">ปิดแท็บนี้ได้เลย ค่าที่บันทึกจะมีผลกับ /crew ครั้งถัดไป ไม่ต้องรีสตาร์ท</p></div>'; }
api('/api/state').then(s=>{ S=s; cfg=JSON.parse(JSON.stringify(s.merged));
  cfg.models=cfg.models||{}; cfg.reviewers=(cfg.reviewers||[]).filter(k=>s.cli[k]||s.agents[k]);
  scope=s.hasProject?'project':'project'; render();
  msg('อ่านค่าปัจจุบันแล้ว แก้ได้เลย'); });
</script></body></html>`;
