# ai-crew configuration

## Where config comes from (later layers override earlier ones)

1. `${CLAUDE_PLUGIN_ROOT}/config/defaults.json` — shipped defaults
2. `${CLAUDE_PLUGIN_ROOT}/config/modes.json[<mode>]` — preset for the selected mode (eco / normal / strict)
3. `~/.claude/ai-crew.json` — the user's global overrides (all projects)
4. `<project>/.crew/config.json` — this project's overrides (wins)
5. Command-line flags on `/crew`: `--eco`, `--normal`, `--strict`, `--rounds N`, `--lang th|en`, `--no-auto` (win over everything, for this run only)

Merge rule: shallow per top-level key, except `models` which merges per role. A role value is an ordered fallback list: try the first model; on error / rate limit / unavailable, try the next; `inherit` means "the model running this session".

Load it with one command (works in bash and Git Bash; PowerShell users: the skill provides an equivalent):

```bash
node -e '
const fs=require("fs"),p=require("path");
const root=process.argv[1], home=process.env.HOME||process.env.USERPROFILE;
const rd=f=>{try{return JSON.parse(fs.readFileSync(f,"utf8"))}catch{return {}}};
const d=rd(p.join(root,"config/defaults.json")), modes=rd(p.join(root,"config/modes.json"));
const u=rd(p.join(home,".claude/ai-crew.json")), pr=rd(".crew/config.json");
const mode=pr.mode||u.mode||d.mode||"normal";
const layers=[d,modes[mode]||{},u,pr];
const out={};
for(const L of layers){for(const k of Object.keys(L)){ if(k==="models"){out.models={...(out.models||{}),...L.models}} else if(k.startsWith("$")){} else out[k]=L[k]; }}
out.mode=mode; console.log(JSON.stringify(out,null,2));
' "$CLAUDE_PLUGIN_ROOT"
```

## Keys

| Key | Type | Meaning |
|---|---|---|
| `language` | `"auto"` \| `"th"` \| `"en"` \| any language name | Language for everything the user reads (status lines, questions, final report). `auto` = the language of the user's task message. Internal worker prompts may stay English. |
| `mode` | `"eco"` \| `"normal"` \| `"strict"` | Preset. See `config/modes.json`. |
| `models.lead` | string[] | Fallback chain for lead-brain (planning, triage, report). |
| `models.coder` / `tester` / `scout` / `writer` | string[] | Fallback chains for workers. Accepted values today: `fable`, `opus`, `sonnet`, `haiku`, `inherit`. Full model IDs may also work but are not validated. |
| `reviewers` | string[] | Ordered reviewer chain. CLI reviewers: `codex` (Codex CLI), `gemini` (Gemini CLI), `antigravity` (Antigravity CLI `agy`). Agent reviewers: `opus` / `sonnet` / `fable` = the `reviewer-fallback` agent run on that model. The first reviewer that is available is used; on rate limit the next one is tried. |
| `max_rounds` | int | Max review→fix cycles before stopping and reporting to the user. |
| `double_review` | bool | When true, the round passes only if the first TWO available reviewers in the chain both return PASS. |
| `auto_mode` | bool | Whether the UserPromptSubmit hook reminder should make the crew start without `/crew`. (The hook always fires; this flag tells the session whether to honor it.) |
| `auto_mode_min_files` | int | Auto mode only kicks in when the task is expected to touch at least this many files. `1` = any code change. `2` = single-file edits stay direct. |
| `rules_file` | path | Project-specific rules the lead must obey and pass to every worker. Created by `/crew-config` from `templates/rules/*.md`. |
| `state_dir` | path | Where state, review requests and reviewer outputs live. Default `.crew`. |
| `backup_suffix` | string | Suffix pattern for pre-edit backups. `YYYYMMDD` is replaced with today's date. |
| `git.commit` | `"never"` \| `"ask"` \| `"auto"` | `never`: the crew never commits (user commits). `ask`: propose a commit message and wait. `auto`: commit after PASS with a Co-Authored-By trailer. |
| `git.add_state_dir_to_gitignore` | bool | Add `state_dir/` to `.gitignore` once. |
| `deploy.manual` | bool | User deploys by hand → the report must list every changed file with full path and the crew must never upload. |
| `deploy.list_changed_files` | bool | Always end the report with the changed-file list. |

## Reviewer availability and exit codes (scripts/review.*)

| Exit | Meaning | Reason line printed first |
|---|---|---|
| 0 | VERDICT: PASS | — |
| 1 | VERDICT: FAIL, or no verdict line | — |
| 2 | this reviewer unavailable, try next | `REVIEWER_NOT_FOUND` / `REVIEWER_NOT_LOGGED_IN` / `REVIEWER_RATE_LIMITED` / `REVIEWER_ERROR` |
| 3 | no CLI reviewer left in the chain | `NO_CLI_REVIEWER` → use the `reviewer-fallback` agent with the first model name in the chain |

CLI reviewer notes: `codex` writes its answer with `--output-last-message`; `gemini` and `agy` print to stdout and the script captures it. `agy` is always run with stdin closed — `agy -p` silently writes nothing to a redirected stdout otherwise (antigravity-cli issue #76). Any reviewer that produces no output is treated as unavailable and the chain moves on.
