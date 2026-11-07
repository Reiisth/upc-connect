# Local UPC Connect

Run commands from the inner `upc-connect` directory containing package.json.
Docker Desktop must be running. Node/npm and psql are needed for the documented
manual reseed. The wrappers use `npx --yes supabase@3.0.0` (first use may download
the CLI and Docker images). No global CLI installation is necessary.

```powershell
npm run db:local:start
npm run db:local:reset
npm run db:local:status
```

Reset destroys only the disposable local database and recreates the baseline,
then `bootstrap/current_reference.sql`, then `seed.sql`. CLI 3.0.0 uses
`supabase db reset` locally by default and does not accept the old `--local`
flag. The wrappers allow only fixed commands with no extra flags and remove
Supabase/PG target environment overrides. Never add a remote target flag.
SQL files cannot independently authenticate their execution environment; do not
send the fixture SQL to a hosted SQL editor or hosted psql connection.

The project ID is `upc-connect-local`; standard local ports are 54321 (API),
54322 (database), 54323 (Studio), 54324 (test email). Use status for actual keys.
Keep these credentials in an ignored `.env.supabase.local` file:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local public/publishable key from status>
SUPABASE_SECRET_KEY=<local secret/service-role key from status>
UPC_LOCAL_TEST_PASSWORD=<locally chosen password of at least 12 characters>
```

The application names above are intentional; do not rename them to ANON_KEY or
SERVICE_ROLE_KEY. Legacy local anon/service-role values, if emitted by the stack,
map to the public/server variables respectively. Never commit actual credentials.
The setup scripts do not implicitly load `.env.local`, which may point at hosted
Supabase. Shell variables take precedence over `.env.supabase.local`; a hosted
URL is rejected before any request. Privileged requests also reject redirects.

```powershell
npm run db:local:auth
npm run dev:local
```

Auth setup uses the supported Admin API, confirmed example.com users, and the
real profile trigger. It checks profiles, resolves roles by key, assigns demo
branch access, and links Bagong to demo.member@example.com as connected. It
never inserts raw auth.users rows or changes role-permission grants. Reruns
preserve existing passwords and archived state, and reject conflicting member
ownership. It adds required assignments without removing QA-added assignments;
reset for an exact clean account state.

Accounts: demo.admin, demo.pastor, demo.accounting, demo.evangelism,
demo.ministry, demo.usher and demo.member, all at example.com. Pastor and
evangelism get both demo branches, accounting/usher North, ministry South;
administrator is system-wide and member has linked self-service only.

`dev:local` supplies local variables to Next.js without changing hosted env files.
Optional GEMINI_API_KEY integrations remain independent and can make
external requests when those features are used. Stop the local Next process and
run normal `npm run dev` with the original hosted environment to return to hosted
Supabase. Do not run both apps on the same port.

Prefer full reset for reproducibility. A demo-only reseed refreshes relative
Manila dates, names and scenario state; linked member account status is retained.
It does not reset role grants. Use `npm run db:local:reseed` for a fixed loopback
psql target. Reference bootstrap is for an empty local schema only, not a live
configuration refresh; duplicate rows fail rather than overwriting UI edits.

See DEMO_DATA.md for the scenario matrix and LOCAL_SUPABASE_VALIDATION.md for
actual validation results/limitations. The manifest hashes capture provenance;
production deployment requires a separate migration-history decision.

Run `npm run db:local:verify` after Auth setup to verify counts, reference rows,
RBAC, logins, Reports and representative inactivity scenarios. With the app
running at 127.0.0.1:3000, `npm run app:local:verify` checks authenticated staff
and member page responses. These commands use local credentials only.

## Laptop-only and LAN/mobile development

Keep `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` in
`.env.supabase.local`, including when testing on a phone. Auth setup, database
verification and privileged helpers remain loopback-only. If a previous test
changed this value to a LAN IP, restore it first and clear any overriding shell
`NEXT_PUBLIC_SUPABASE_URL` value.

Laptop-only workflow:

```powershell
npm run db:local:start
npm run db:local:reset # Only when you want to erase/rebuild local fixtures.
npm run db:local:auth
npm run dev:local
```

`dev:local` binds to 127.0.0.1 and ignores the LAN host option.

For a phone on the same trusted LAN:

1. Start local Supabase and run Auth setup with the loopback configuration.
2. Stop any existing Next.js process using port 3000.
3. Run `npm run dev:lan`. It detects the current private IPv4 using the OS route
   with an interface fallback; no source/config edit is needed after DHCP changes.

```powershell
npm run dev:lan
```

LAN resolution uses one shared asynchronous helper, in this order:

1. Validated `UPC_LOCAL_LAN_HOST` override, when supplied.
2. OS route-selected private IPv4: a UDP socket connects to a numeric IPv4
   destination solely to query its local source address. It sends no datagram,
   waits for no remote response, and closes on success, error or a 1.5s timeout.
3. If the route probe fails or returns a non-private address, interface fallback
   excludes loopback/public/link-local/IPv6 and recognizable virtual/VPN adapters,
   prefers recognizable physical adapters and requires one best private address.
4. Ambiguous fallback fails with candidate names/addresses and override guidance.

The default route may itself belong to a VPN. Use the explicit private-IP override
when the OS route is unsuitable for phone access. Offline LAN use does not require
an Internet response; an unambiguous interface fallback works without a route.
All browser URL and Next allowedDevOrigins configuration receives the same resolved
host; next.config.ts performs no independent discovery.

For an unusual network, explicitly override with a private RFC1918 IPv4:

```powershell
$env:UPC_LOCAL_LAN_HOST = Read-Host 'Intended private LAN IPv4'
npm run dev:lan
# Restore automatic discovery afterward:
Remove-Item Env:UPC_LOCAL_LAN_HOST -ErrorAction SilentlyContinue
```

An override may also be placed in ignored `.env.supabase.local`, but remove it
when returning to automatic discovery. An existing override deliberately wins
and can become stale after a network change. Loopback, hostnames, public IPs,
URLs, credentials, ports and paths are rejected as LAN overrides. `dev:local`
does not perform discovery and stays bound to loopback.

Startup prints Local app (127.0.0.1), LAN app (detected address), Browser Supabase
(detected address, configured API port), and Privileged Supabase (loopback).

4. Open `http://<LAN-IP>:3000` from the phone. The launch message must show
   `Browser Supabase: http://<LAN-IP>:54321` (with the configured API port).
5. Confirm the API is reachable at that address from the phone. Next.js binds
   to 0.0.0.0; the validated host also configures its development-origin allowlist.
   If needed, allow the app/API ports on the laptop's private-network firewall.

On a phone, 127.0.0.1 refers to the phone itself, not the laptop. Only the Next.js
child process gets the browser-facing LAN URL. Its privileged server client
uses `UPC_LOCAL_INTERNAL_SUPABASE_URL`, set by the launcher to verified loopback.
That variable and SUPABASE_SECRET_KEY are server-only, never NEXT_PUBLIC values.
The development override is ignored in production. Setup scripts do not consume
the LAN host and remain strict even if the optional host is configured.

Password login with confirmed demo accounts requires no redirect-list change
and works at the detected LAN address. Supabase Auth keeps canonical localhost
`site_url` and localhost/127.0.0.1 callback entries. Email/OAuth links that fall
back to site_url should be completed on the laptop at localhost; arbitrary LAN
email/OAuth callbacks are not automatically authorized by this command. The
forgot-password page requests its current origin; on a LAN origin that is not
allowlisted Supabase can fall back to the canonical localhost URL. Use localhost
for these email flows. No per-DHCP source/config edits or broad host wildcards
are needed for ordinary LAN password login. A generated, narrowly scoped Auth
callback configuration is separate work if phone email/OAuth testing is needed;
it would require restarting the local Auth service. This launcher does not mutate
Supabase configuration or restart/reset the stack.

Browser camera/QR and some PWA features require a secure context; HTTP on a LAN
IP may not support them. This mode addresses connectivity/login testing.

## Avoid mixing Next.js runtimes

Run one Next.js server on the intended port. The local launcher probes IPv4 and
IPv6 loopback and refuses an existing listener; it supplies an explicit port so
Next cannot silently choose another. `PORT` can select a different explicit port
when intentionally testing a separate instance. Raw `next dev`/`next start`
commands bypass this launcher check.

Stop development before building, then restart the desired mode. After switching
between a production build and development/bundlers, open a fresh tab or hard
reload so an old client runtime cannot consume new server-component metadata.
Do not run an old loopback-only production server alongside a wildcard LAN dev
server on port 3000: Windows can allow both listeners, giving each origin a
different runtime. Next manages chunk paths; no assetPrefix/publicPath override
is needed. All `/_next/` endpoints bypass application auth routing, and local/LAN
development origins are explicitly allowed for HMR.

See [chunk investigation](NEXT_CHUNK_INVESTIGATION.md) for the observed process
conflict, verified HMR issues, browser results and limits of the diagnosis.

### Public env precedence and restarting

The launcher loads `.env.supabase.local` only for variables absent from its shell
and validates a loopback API URL. It computes the browser URL once (loopback or
resolved LAN host), then supplies it in the Next child's process environment
BEFORE Next starts. Next process.env takes precedence over .env.development.local,
.env.local, .env.development and .env, in that order. The startup line
`Environments: .env.local` lists a file read; it does not imply that file replaced
an already supplied value. Managed local Next startup logs its effective public
Supabase URL separately, without keys.

Managed local development disables Turbopack filesystem caching to avoid reusing
persisted client chunks containing a previous endpoint across mode/DHCP changes.
Production cache configuration is unchanged. Restart Next after switching modes
or networks, then reload browser tabs. Public env is compiled startup/build data,
not a runtime client setting. Keep .env.supabase.local loopback; do not put a LAN
URL in .env.local. The latter can retain the developer's hosted configuration for
normal hosted workflows. Local privileged clients remain loopback-only.
