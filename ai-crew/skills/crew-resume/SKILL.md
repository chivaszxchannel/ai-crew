---
name: crew-resume
description: >
  This skill should be used when the user invokes "/crew-resume", says "continue", "resume the crew",
  "pick up where the crew left off", "ทำต่อ", "งานเมื่อกี้ทำต่อ", or after switching models with
  /model or starting a new session while <state_dir>/state.md is still in-progress. It reloads the
  team state and continues the /crew loop from the recorded step without redoing finished work.
metadata:
  version: "0.2.0"
---

# /crew-resume — a new lead picks up the job

Use after a new session, a context compaction, or a `/model` switch because the previous model hit its limit.

## Steps

1. Load the merged config (`references/config-schema.md` in the crew skill) — the state file also carries the config that was in force; prefer the state's copy for this job so a config change mid-job does not silently change the plan.
2. Read `<state_dir>/state.md` in full. Missing or `status: done` → tell the user there is no open job and stop.
3. Tell the user, in 3 lines, in the reply language: the job, the step it is at (scout / plan / build / review round N / report), what is left. Continue without waiting unless `status: blocked`, in which case ask whether to keep fixing or accept the risk.
4. Append to `model_log`: "resumed by <session model> at <time>".
5. Verify against the disk before continuing (send the scout if many files): files in "Changed files" exist and have their backups; subtasks marked `done` are really in the code; the last review file matches the recorded verdict. Where state and disk disagree, trust the disk, correct the state, then continue.
6. Continue the `/crew` loop from the recorded step with the same rules, including the lead model fallback chain.
7. In the final report, note under the lead: "resumed by <model> from step <...>".

## Never

- Re-scout or re-plan when state already has them (wastes quota and can produce a different plan).
- Reset `round` to 0; keep the recorded value.
- Commit, delete, or deploy — same rules as `/crew`.
