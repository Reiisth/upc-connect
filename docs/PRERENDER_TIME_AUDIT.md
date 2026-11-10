# Partial-prefetch current-time and cache-warming audit

## Confirmed sources and classification

The reported RSC error was reproduced in development on Baptisms and Members even after removing client render clock reads. A temporary stack-only diagnostic traced it to `node_modules/@supabase/auth-js/src/GoTrueClient.ts:3057` (`dist/module/GoTrueClient.js:2531`): `__loadSession()` checks `currentSession.expires_at * 1000 - Date.now()` before a network fetch. The application call path is `lib/supabase/server.ts` -> Supabase session loading -> `getCurrentUser()` -> `requireActiveAccount()` -> `PortalShell`. The layout frame was an owner frame, not the clock source.

This is category B: current-time-dependent authentication/token expiry. It must not be frozen into a prerender or replaced with telemetry timing. Cookies alone did not prevent this runtime-shell diagnostic during Partial Prefetching.

There was also category C/browser bookkeeping in `PortalRuntime.tsx`: the original lines 11–12 called `useRef(Date.now())` during render. Client Components also render on the server. These refs now start at zero and initialize in effects. The mount effect initializes the session-check clock; the pathname effect initializes/resets the page-refresh clock. Existing callback/effect clock reads remain browser-only.

## Narrow fix and installed API

The installed Next 16.3.3 `io` and `connection` documentation was read. `lib/supabase/server.ts:16` now awaits `io()` immediately before `createServerClient()`, after obtaining request cookies. `io()` is supported in private cache scopes and allows prefetching, unlike `connection()`, which waits for a full navigation and is forbidden inside a private cache. No `connection()` call was added.

No layout-wide boundary, force-dynamic export, global Partial Prefetching flag, static authorization cache, RLS change, or client-side authorization was introduced. The persistent PortalShell and portal-only partial export remain. Existing authorized private content remains dynamic/session-specific; no previously static page was converted wholesale to dynamic rendering.

## Cache-warming error: separate trigger

The render-clock-only fix still produced two warming warnings in a production Reports -> Members -> Inactivity trace. Redacted Next cache diagnostics identified different serialized argument hashes for the same cached Members/Inactivity function between warming and final rendering. The matching compiler IDs mapped to those page content functions. Both received Next's live `searchParams` promise.

Members and Inactivity now resolve the URL promise under their existing Suspense boundary before calling their private cached content functions with resolved values. Reports uses the same pattern and was corrected too. This keeps URL-stage dependencies out of the cached function's serialized live-promise arguments. It does not disable caching or alter TTLs/tags/permission checks. The resulting route deferral is appropriate until URL values are available. This is not a claim that Next never supports Promise cache arguments; it is the fix verified for these route wrappers and this installed runtime.

The clock warning and warming warning share the Partial Prefetching context but have distinct triggers. Fixing the clock alone did not fix warming. After the URL-boundary change, the production traces contained zero warming warnings. These errors were not caused by a custom process-local server cache expiring: there is no such TTL implementation in this work. React `cache()` is request memoization; `use cache: private` uses Next-managed browser-memory reuse, not durable process-local server state. Cache lifetimes remain controlled by `cacheLife`; browser freshness scheduling uses Date.now safely after mount. No deployment is assumed to share an in-memory server cache.

## Baptisms and other time reads

- Baptisms' outer page/Suspense fallback is prerenderable. Private BaptismsContent (60-second stale window) performs permission and branch checks, record reads, and summary reads.
- `loadModuleSummary` computes Manila today and the reporting window inside that authorized private execution. These are query/business dates (category B), evaluated per server execution and reused for the existing client freshness window, not frozen in static HTML indefinitely.
- BaptismsTable's fallback today calculation is inside the period-change event handler. Initial dates come from the server summary. Explicit-date constructors in formatting/parsing are deterministic inputs, not reads of now.
- Contributions has the analogous event-handler fallback. Scanner Date.now calls are scan-event deduplication. Mutation timestamps, AI generation timestamps, and archive timestamps run in actions, not prerendered page shells.
- Reports/inactivity/follow-up/service loaders use current dates for authorized request/private content. Staff ban-expiry checks are request-authorized reads. Services' schedule comparator and member card/profile age helpers also read current time; these were audited, not broadly rewritten. Services passed the clean development check. Member card/profile ages were not exhaustively exercised across birthdays/midnight; no new warning was observed from them in the tested flows.
- No render-time timestamp-generated React IDs/keys or repository telemetry requiring a performance.now conversion was found.

## Verification and measurements

All 472 tests passed, with no skips. ESLint, `npx tsc --noEmit` (the actual project typecheck command), and production build passed. Two new regression tests verify render-time clock avoidance/post-mount initialization and that Supabase construction waits for IO while preserving cookie read/write behavior.

| Probe | Previous baseline | Final production run |
| --- | --- | --- |
| Initial Reports Supabase requests | 40 | 40 |
| Cached Members | 264–280 ms | 307–328 ms |
| Cached Reports | 327 ms | 324 ms |

Navigation measurements include a fixed 200 ms settling delay; these are individual QA runs, not latency guarantees. Another post-key-fix run with 600 ms settling measured Members 653–697 ms and Reports 683 ms, consistent with short cached transitions. One earlier rapid Reports return probe stalled; subsequent repeated and final probes passed. Initial private Members/Inactivity visits remain multi-second server reads; no eager whole-portal loading was introduced.

Clean development checks: direct Baptisms, Members, Services, plus Inactivity hover/navigation showed no unstable-time, dynamic-prefetch, cache-warming, or hydration diagnostics in the exercised flows. Admin My Profiles correctly redirected to access-denied in the local fixture. The LAN dev server was restarted after removing temporary in-memory stack tracing; no diagnostic import remains.

Production checks: direct Baptisms rendered, the current-month preset produced correct From/To dates and its summary update completed, member direct Baptisms/Inactivity requests were denied without protected content, sign-in worked, logout caused session 401, and browser Back could not restore private member data. Final server log contained zero unstable-time/warming diagnostics. The unrelated existing warning about a package-lock outside the Git root remains.

## Changed files for this correction

- `lib/supabase/server.ts`: explicit SDK IO boundary.
- `app/portal/PortalRuntime.tsx`: start browser clocks after mount.
- `app/portal/members/page.tsx`, `app/portal/inactivity/page.tsx`, `app/portal/reports/page.tsx`: resolve URL promises outside private cached content.
- `tests/portal-runtime-clock.test.cjs`: two regressions.
- This audit and the follow-up link in `PARTIAL_PREFETCHING.md`.

No dependencies, migrations, hosted records, or production environment settings were changed. Existing unrelated working-tree performance edits were preserved.
