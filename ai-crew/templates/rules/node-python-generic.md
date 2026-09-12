# Project rules for the crew — Node.js or Python service

The lead must obey these and paste the "Rules for workers" block into every worker prompt.

## Stack
- Runtime: <Node 20 | Python 3.12> ; framework: <Express | Fastify | FastAPI | Django | none>
- Syntax / type check: <`node --check`, `npx tsc --noEmit`, `python -m py_compile`, `mypy`>
- Tests: <`npm test` | `pytest -q`>
- Package manager: <npm | pnpm | pip | poetry | uv>

## Deploy
- <Docker image via CI | pm2 on a VPS | systemd | manual> — fill in
- Never touch `.env*`, `docker-compose*.yml`, or CI config unless the user asks in that message.

## Rules for workers
- Back up any existing file before editing it: `cp -n <file> <file>.bak_YYYYMMDD`.
- Run the project's test command after every change set; a failing test is a failed task.
- Do not add dependencies without being told; if one is truly needed, stop and report.
- Keep public function / route signatures unless the task says otherwise; grep for callers first.
- Never run git commit / push / reset, never delete files, unless the user asks in the same message.
- Every claim needs evidence: attach the command and its output, or file:line.
