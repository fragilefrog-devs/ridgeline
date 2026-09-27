# AGENTS.md — RidgeLine

AI scheduling/dispatch assistant for solo tradespeople. React 19 + Vite frontend, single-file
Express backend (`server.ts`, ~2.9k lines), Neon Postgres, Twilio, Gemini / OpenAI-compatible LLM.

## Commands

```bash
npm install --legacy-peer-deps   # REQUIRED, see esbuild note below
npm run dev          # tsx server.ts  ->  http://localhost:3000  (serves UI + API together)
npm run build        # vite build -> dist/  (frontend only; no server build step)
npm start            # identical to `dev`; differs ONLY via NODE_ENV=production
npm run lint         # this is just `tsc --noEmit`
```

- **One process, one port.** `npm run dev` starts Express on a **hardcoded `PORT = 3000`**
  (`server.ts:21`, not env-configurable) and mounts Vite in `middlewareMode` inside it
  (`server.ts:2862-2881`). There is no separate Vite dev server, no second port, no proxy config.
- Frontend calls the API with **relative `/api/...` paths only** — same-origin by design. Don't
  introduce an API base URL or a separate frontend origin.
- `DISABLE_HMR=true` turns off HMR *and* file watching (AI Studio convention; see the comment
  block in `vite.config.ts` — don't "fix" it).
- There is **no test runner, no `test` script, no ESLint, no Prettier, no CI, no husky.**
  `npm run lint` being `tsc --noEmit` is the entire verification story. The baseline **is clean**
  (verified: `npx tsc --noEmit` exits 0), so any error you see is yours — don't excuse it.
- **Plain `npm install` fails with ERESOLVE** (verified): `package.json` pins `esbuild@^0.25.0` but
  `vite@8.3.1` declares `peerOptional esbuild@^0.27.0 || ^0.28.0`. Always use `--legacy-peer-deps`.
  This is why `bun.lock` is the real lockfile.
- `tsconfig.json` has no `include`/`files`, so `tsc` typechecks **everything together** —
  `server.ts`, `neon.ts`, `hello.ts`, `scripts/*.ts`, `src/**`. `types: ["vite/client"]` omits
  Node globals that `server.ts` and `scripts/*` use. No `strict`. Lockfile is **TypeScript 7.x**.
- Lockfile is `bun.lock` (committed) but scripts are npm, and there's no `packageManager` field.
  Don't mix bun/npm installs casually — you'll get lock drift.
- `npm run clean` uses `rm -rf`, which breaks under npm's default Windows script shell (cmd.exe).

## Architecture

```
server.ts          Express + all API routes + AI pipeline + DB + auth  (monolith, no modules)
  initDb()         server.ts:2692-2859  inline DDL, runs on EVERY boot
src/App.tsx        1k-line orchestrator: all state, all API calls
src/components/    20 components (shadcn-style `ui/` only has button.tsx + sidebar.tsx)
src/lib/           chartUtils.ts, utils.ts
src/types.ts       the ONLY client-side type contract
scripts/           migrate.ts, migrate-auth.ts (not wired into package.json)
supabase/migrations/  20260927000000_init_ridgeline_schema.sql
```

- **`server.ts` and `src/` are fully decoupled — no shared types.** `server.ts` imports nothing
  from `src/`, and every request body is untyped `any`. `src/types.ts` is an independent mirror.
  Any API contract change must be made on **both** sides by hand.
- **Routing is hybrid, and this surprises people.** react-router defines only `/auth`,
  `/onboarding`, and `*`. All seven main views (overview/dispatch/sms/missed_calls/customers/
  services/settings) are the `activeTab` state var in `App.tsx`. Switching views does not change
  the URL, and you cannot deep-link a view. Don't add `<Route>`s and expect `activeTab` to follow.
- **All API calls go through `apiFetch()` (`src/lib/apiFetch.ts`)** — never bare `fetch(...).json()`.
  It checks `res.ok` and `content-type` first, so a missing/misrouted backend reports a readable
  error instead of `Unexpected token 'T', "The page c"... is not valid JSON`. Keep new call sites on it.
- **`server.ts` ends `startServer()` with a JSON 404 for unmatched `/api/*`** (just above the Vite
  middleware). Without it, an unknown API path falls through to the SPA and returns `index.html` with
  **HTTP 200**, making a missing endpoint look like a success. Register new routes at module scope
  (before `startServer()` runs), not inside it, or the 404 will swallow them.
- `neon.ts` + `hello.ts` + `.neon` are a **vestigial Neon Functions scaffold**. The real backend is
  Express. Nothing imports `hello.ts` — don't build on it.

## The silent-fallback trap (read this before debugging "it works")

Every external dependency degrades to mock data instead of erroring, so a misconfigured server
looks like a working one:

| Missing | What happens |
|---|---|
| `DATABASE_URL` | `pool` stays `null`; `initDb()` returns immediately; every route serves hardcoded `inMemory*` arrays; `requireAuth` falls back to `inMemoryUsers[0]`. **Nothing persists.** |
| `OPENAI_COMPATIBLE_*` | Falls back to a hardcoded base URL + hardcoded API key, then Gemini, then a deterministic rule-based responder. |
| `GEMINI_API_KEY` | `ai` stays `null`; that fallback tier is skipped. |
| `TWILIO_*` | `twilioClient` is `null`; nothing is actually sent. |

Check `GET /api/neon/status` and the server boot log before concluding a feature works.
`toUuid()` (`server.ts:283`) md5-hashes non-UUID input into a *stable* UUID, which is why in-memory
IDs look real and survive restarts.

## Database & migrations

- **The schema lives in three places that must be kept in sync by hand:** inline DDL in
  `initDb()`, `supabase/migrations/20260927000000_init_ridgeline_schema.sql`, and
  `scripts/migrate.ts`. Adding a table/column means editing all three, or the next server boot
  will silently patch around you.
- **`initDb()` runs on every boot** — it creates schema `app`, tenant helper functions, the
  `ridgeline_app` role, tables, indexes, and RLS policies. It also `DROP POLICY IF EXISTS` +
  recreate, so a hand-written policy tweak gets reverted on restart.
- Migration scripts are **not** in `package.json`. Run them explicitly:
  `npx tsx scripts/migrate.ts` / `npx tsx scripts/migrate-auth.ts`.
- `scripts/migrate.ts` **hardcodes one filename** (`20260927000000_init_ridgeline_schema.sql`).
  A newly added migration file is silently ignored until that line is updated.
- Multi-tenancy: `runTenantQuery()` (`server.ts:365`) wraps each query in a txn, sets
  `app.current_organization_id` / `app.current_user_id` via `set_config`, then `SET LOCAL ROLE
  ridgeline_app` so RLS actually applies. Go through it; don't call `pool.query` directly.
- Env loading is `dotenv.config({path:'.env.local'})` then `dotenv.config()` — **relative paths, so
  cwd must be the repo root.** `.env.local` wins (dotenv doesn't override). `.gitignore` covers
  `.env*` except `.env.example`.

## Auth

- `requireAuth` accepts the `ridgeline_session` cookie **or** `Authorization: Bearer <jwt>`. The
  frontend mirrors the token into `localStorage.ridgeline_session_token` and sends it as a Bearer
  header alongside `credentials: 'include'`. Both paths are live — keep them working.
- Passwords: PBKDF2-SHA512, 1000 iterations, 16-byte salt, stored as `salt:hash`.
- `JWT_SECRET` / `SESSION_SECRET` / `COOKIE_SECRET` are **absent from `.env.example`** and fall
  back to hardcoded constants — one of which is literally named `...-production`. Always set them.
- Unauthenticated endpoints (no `requireAuth`): `/api/auth/register`, `/api/auth/login`,
  `/api/auth/logout`, `/api/sms/process`, `/api/missed-call/process`, `/api/ai/test-endpoint`,
  and the three `/webhooks/twilio/*`. Don't add new unauthenticated routes casually.

## AI pipeline

- `runSmsAssistant()` (`server.ts:2018`) is the shared pipeline:
  **OpenAI-compatible → Gemini (`@google/genai`) → deterministic rule-based fallback.**
  Per-org overrides (`llmProvider`, `openaiBaseUrl`, `openaiApiKey`, `openaiModel`) come from
  `assistant_settings` and win over env.
- The prompt demands a strict JSON schema; responses are fence-stripped then `JSON.parse`d.
- **Secret landmine:** a live-looking `sk-…` key is hardcoded as `DEFAULT_OPENAI_API_KEY` in
  `server.ts:129` *and again* in `src/mockData.ts:56` — the second one ships in the client bundle.
  `README.md` also publishes real-looking gateway credentials. Don't copy any of these, and
  rotate/remove them before any real deployment.
- `scripts/migrate-auth.ts` seeds a demo user with a **hardcoded password committed to the repo**.
  Same treatment.

## Twilio

- Webhooks use a scoped `express.urlencoded` parser (`twilioFormParser`) mounted per-route;
  the global `express.json()` only applies to `/api/*`. Don't move webhook routes above the
  global JSON parser.
- `verifyTwilioSignature` **bypasses verification** when `TWILIO_AUTH_TOKEN` is unset and
  `NODE_ENV !== 'production'`; in production it hard-fails with 500. Don't rely on the dev bypass.
- The validation URL prefers `APP_URL` over request host — set `APP_URL` in any proxied
  deployment or signatures will mismatch.

## Known drift

- `README.md`'s project tree is stale: it omits `scripts/`, `neon.ts`, `hello.ts`, `.neon`,
  `src/lib/`, and several components (`AIIcon`, `EmptyState`, `SettingsView`, `RidgeLineLogo`,
  `OnboardingWizard`, `ui/`). Trust the code, not the tree.
- `README.md`'s "Environment Configuration" section publishes live-looking API credentials.
  Don't paste them into `.env`, docs, or commits.
- `/api/neon/execute-sql` (auth'd) executes caller-supplied SQL, and `/api/ai/test-endpoint`
  (unauth'd) proxies to a caller-supplied `baseUrl`. Both are dev/debug affordances — don't
  expose them on a public origin.
- `src/App.tsx` seeds every collection from `src/mockData.ts` and then overwrites from
  `/api/neon/data`. There are two sources of truth for each list during startup.
- **This is one Node process, not a static site.** `server.ts` serves the UI *and* the API, so the
  host must run `npm start`. A static-only host (e.g. a Vercel static deploy with no `vercel.json`
  and no functions) serves `index.html` for `/` and returns Vercel's `text/plain` 404 body
  `The page could not be found` for **every** `/api/*` call — the app shell loads, then every
  request dies in `res.json()`. If the app "loads but all data is broken", check that the backend
  is actually deployed before debugging the frontend. There is no `vercel.json`/`render.yaml`/
  `Dockerfile` in the repo — deployment is currently unconfigured and host-specific.
