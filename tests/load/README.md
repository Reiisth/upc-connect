# Cookie-authenticated k6 tests

The endpoint is disabled by default. It uses the existing Supabase SSR server
client and its Next.js cookie adapter; it returns only `{ success: true }`.
The exact endpoint is exempted from the proxy login redirect so its own gates can
run. Portal authentication, RBAC, active-account checks and RLS remain unchanged.
Only POST is implemented (GET returns 405). Disabled POST requests return 404.
No shared request-rate limiter exists; no new dependency was added.

## Temporary configuration

Provision a dedicated active account with the minimum scoped read permissions for
members, attendance and reports (`members.view`, `attendance.view`, `reports.view`).
Do not use a system administrator. Supply its password to k6 at runtime.

In the target server/Vercel environment temporarily set:

```dotenv
ENABLE_LOAD_TEST_AUTH=true
LOAD_TEST_SECRET=<random high-entropy server-only secret>
LOAD_TEST_EMAIL=<exact dedicated account email>
```

Redeploy if needed. Never prefix these with NEXT_PUBLIC_, commit real values,
or log credentials/cookies. After testing set ENABLE_LOAD_TEST_AUTH=false (or
remove these variables), redeploy, and confirm POST returns 404 again.

## Run manually (PowerShell)

Set these environment variables in the shell using your secret manager or local
untracked environment: BASE_URL, LOAD_TEST_SECRET, TEST_EMAIL, TEST_PASSWORD.
BASE_URL defaults to https://www.upc-connect.org. TEST_EMAIL must exactly match
the server's LOAD_TEST_EMAIL. Use the canonical URL to avoid hostname redirects.

```powershell
k6 run tests/load/authenticated.js
k6 run -e LOAD_PROFILE=5 tests/load/authenticated.js
```

The first command is 1 VU / 1 iteration. The second is 5 VUs / 30 seconds.
Only after reviewing results, manually select LOAD_PROFILE=10 (1 minute),
25 (2 minutes), or 50 (2 minutes). No load test runs automatically.

Each VU logs in separately and retains its own cookie jar across iterations.
Requests use no bearer tokens, redirects are disabled, and read-only page visits
include 1–2 seconds of thinking time. Failures log only page labels and statuses.
The summary includes request count, error rate, median (p50), p90, p95, p99, and
page-tagged duration submetrics. Failed checks also fail the run.

**Portal entry behavior:** /portal is intentionally a redirecting workspace
selector, not a dashboard returning 200. The test accepts only an explicit
same-origin redirect to reports, members or attendance, then requires 200 from
that destination. Members, attendance and reports each require 200; login or
access-denied redirects fail validation. This preserves the existing app flow.

## Deployment verification

Before increasing load, use the 1-VU command to confirm the real response sets
SSR cookies and the same jar reaches protected pages. Also verify missing/false
flag (404), absent/wrong secret (404), wrong email/password (401), GET (405),
normal browser /login sign-in, and a fresh unauthenticated /portal request
redirecting to /login. Do not print response bodies, cookie values or secrets.
Unit tests exercise server gates with a stubbed auth boundary; they do not prove
real hosted Supabase cookie issuance or deployed authorization.
