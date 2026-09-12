# Project rules for the crew (generic)

The lead must obey these and paste the "Rules for workers" block into every worker prompt.

## Stack
- Language / framework: <fill in, e.g. Python 3.12 + FastAPI>
- Syntax check command per file type: <e.g. `python -m py_compile <file>`, `node --check <file>`>
- Test command: <e.g. `pytest -q`> (leave blank if none)
- Package manager: <npm / pip / composer / none>

## Deploy
- How code reaches production: <git push to main / CI / manual upload / none>
- Files or folders the crew must never touch: <e.g. .env, secrets/, infra/>

## Rules for workers
- Back up any existing file before editing it: copy to `<file>.bak_YYYYMMDD` (never overwrite an existing backup).
- Keep the file's existing line endings, encoding and indentation.
- Follow the patterns already used in the codebase; do not introduce a new style or library without being told.
- Never run git commit / push / reset, never delete files, never touch secrets, unless the user asks in the same message.
- Every claim needs evidence: attach the command and its output, or file:line.
