# Project rules for the crew — Next.js (App Router) + Supabase

The lead must obey these and paste the "Rules for workers" block into every worker prompt.

## Stack
- Next.js with TypeScript, App Router; Supabase (Postgres, Auth, RLS, Storage, Edge Functions)
- Package manager: <npm | pnpm | yarn — check the lockfile>
- Type check: `npx tsc --noEmit` ; lint: `npm run lint` ; tests: `npm test` if present
- Edge Functions live in `supabase/functions/*`; migrations in `supabase/migrations/*`

## Deploy
- <Vercel on push to main | manual> — fill in. If deploy is automatic on push, the crew must NEVER push.
- Database changes go through a migration file, never by editing the live schema. RLS policies must be written for every new table.
- Never touch `.env*`, service-role keys, or `supabase/config.toml` unless the user asks in that message.

## Rules for workers
- Back up any existing file before editing it: `cp -n <file> <file>.bak_YYYYMMDD`.
- Run `npx tsc --noEmit` after every change set; a type error is a failed task.
- Server components by default; add `"use client"` only where hooks or browser APIs are needed.
- Use the existing Supabase client helpers (`lib/supabase/*`); do not create a new client per file.
- Any new table: migration + RLS policy + TypeScript types regenerated (`supabase gen types`) in the same task.
- Never run git commit / push / reset, never delete files, unless the user asks in the same message.
- Every claim needs evidence: attach the command and its output, or file:line.
