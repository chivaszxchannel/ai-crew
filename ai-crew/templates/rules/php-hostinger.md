# Project rules for the crew — PHP + MySQL on shared hosting, manual SFTP deploy

The lead must obey these and paste the "Rules for workers" block into every worker prompt.

## Stack
- PHP (procedural / light OOP) + MySQL (mysqli or PDO — follow whatever the file already uses)
- Front end: plain HTML/CSS/JS pages, often calling `*_api.php` endpoints that return JSON
- Syntax check: `php -l <file>` for PHP; `node --check <file>` for JS; parse JSON with node
- No build step, no package manager for the app code
- Line endings are usually CRLF; encoding UTF-8 (check for BOM per file). Preserve exactly what each file has.

## Deploy
- The owner uploads changed files by hand over SFTP. The crew never uploads and never commits.
- The final report must list every changed file with its full local path so the owner knows exactly what to upload.
- Never touch `db_config.php`, `.env`, `.htaccess`, or any credential file unless the user asks in that message.
- Never run anything against the production database. Test write actions with throwaway data only.

## Rules for workers
- Back up any existing file before editing it: `cp -n <file> <file>.bak_YYYYMMDD` (never overwrite an existing backup).
- After editing, the tester must confirm: `php -l` passes; counts of `{`/`}` and `(`/`)` match the backup; CRLF count and BOM match the backup.
- Preserve existing auth checks (PIN / session) in every page and API; a new page must use the same auth pattern as its neighbours.
- Use prepared statements for any SQL that takes user input. Never build SQL by string concatenation.
- Keep the JSON response shape that existing callers expect; grep for callers before changing any endpoint or function signature.
- Never run git commit / push / reset, never delete files, unless the user asks in the same message.
- Every claim needs evidence: attach the command and its output, or file:line.
