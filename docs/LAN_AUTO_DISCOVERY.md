# LAN address discovery correction

Validated 2026-11-05 on the local Supabase stack. No hosted data/configuration was
changed, no database reset was needed, and no dependencies were added.

## Address audit

The prior launcher required UPC_LOCAL_LAN_HOST rather than discovering a host.
The earlier runtime had been launched with an explicit shell override pointing
to 192.168.1.13. Current shell and ignored .env.supabase.local have no such
override. Checked .env files without printing credentials.

Repository search included hidden/ignored local configuration and temporary QA
artifacts, excluding generated .next, node_modules and Git internals. Matches:

- tests/local-lan.test.cjs: old address as validation/browser/internal-URL test
  inputs. Replaced with neutral fixture addresses; added detection tests.
- tests/next-dev-runtime.test.cjs: old address as allowedDevOrigins test input.
  Replaced with a neutral fixture address.
- docs/NEXT_CHUNK_INVESTIGATION.md: historical successful browser-validation URL;
  retained as evidence of the previous investigation, not active configuration.
- Ignored supabase/.temp/chunk-validation-192.168.1.13.json: historical response
  URLs throughout the saved validation output; retained.
- Ignored supabase/.temp/phase2l-browser.cjs and phase2l-reports.cjs: previous
  one-off QA origins; retained historical scripts, not package commands/tooling.
- This report records the old address for audit purposes.

No old address is embedded in active scripts, next.config.ts, proxy.ts,
supabase/config.toml, package.json or current local env files. A regression test
checks active launcher/config files. Documentation formerly instructed manually
setting the LAN host and editing callback configuration; that guidance changed.

## Discovery and runtime

scripts/local-lan-host.mjs now resolves in precedence order:

1. Explicit UPC_LOCAL_LAN_HOST, validated as non-loopback RFC1918 IPv4.
2. OS route source address from a UDP IPv4 connect to numeric 8.8.8.8:53.
   No application data is sent; no DNS lookup or remote response is needed.
   Socket closes on success, error, synchronous failure or 1.5-second timeout.
3. Only on probe failure/invalid address: os.networkInterfaces() fallback,
   excluding internal/non-private/virtual/VPN adapters, preferring physical-looking
   names, and requiring one best address. Multiple equally plausible addresses
   fail with candidate details and override guidance.

The previous implementation ranked adapter names without consulting routing.
That could not establish which interface Windows actually used. In this audit,
no old-address adapter or override is currently present, so the exact earlier
192.168.1.13 selection cannot be reproduced or attributed conclusively. The
previously launched process could also retain its launch-time configuration.
Tests reproduce a stale physical Ethernet address alongside the route-selected
Wi-Fi address and ensure the route wins.

The only production discovery implementation is this helper. local-dev-config
awaits it once for LAN mode; dev-local awaits that config. local-env only loads
local credentials, local-dev-port only checks occupied ports, package.json only
invokes the launcher, and next.config.ts consumes the resolved environment value.
Local mode never probes routes or enumerates interfaces. Explicit overrides win
without running either detector and must be removed to resume automatic behavior.
A VPN default route can still require the explicit LAN override.

The resolved host configures NEXT_PUBLIC_SUPABASE_URL and UPC_LOCAL_LAN_HOST for
the Next child process. Existing next.config.ts consumes the latter in its
development-only allowedDevOrigins. No assetPrefix/basePath/rewrite was added.
Next continues binding to 0.0.0.0 in LAN mode. All /_next endpoints still bypass
auth routing; the existing occupied-port guard still prevents mixed runtimes.

The privileged client uses verified UPC_LOCAL_INTERNAL_SUPABASE_URL loopback;
SUPABASE_SECRET_KEY remains server-only. Setup/Auth/reset scripts still require
loopback and never call discovery. Production behavior is unchanged.

Detected here: Wi-Fi 192.168.18.42, excluding WSL vEthernet 172.20.176.1.
Startup without override prints:

```text
Local app: http://127.0.0.1:3000
LAN app: http://192.168.18.42:3000
Browser Supabase: http://192.168.18.42:54321
Privileged Supabase: http://127.0.0.1:54321
```

These addresses are validation evidence, not defaults. A later DHCP address is
discovered on the next launch without editing source or committed configuration.
Restart dev:lan after a network change; a running Next process retains its
compiled browser URL.

## Auth callbacks

Confirmed-account password login does not need a Supabase redirect allowlist
entry and was verified at the discovered LAN origin. Auth site_url and callback
entries remain canonical localhost/loopback. Email/OAuth callbacks on arbitrary
LAN origins are not automatically enabled; complete these flows on the laptop
at localhost. The forgot-password page requests its current origin; an unlisted
LAN origin can fall back to canonical localhost. Phone email/OAuth callback
testing remains a documented limitation. No broad redirect wildcard, generated
Auth config, stack restart or per-DHCP source edit is necessary for password
login. See [LOCAL_SUPABASE.md](LOCAL_SUPABASE.md).

## Validation

- 352 tests passed, zero failed/skipped, including disposable local PostgreSQL
  suites. Coverage includes all private ranges, rejection/exclusion cases,
  physical priority, ambiguity, override validation, URL separation, local mode,
  old-address runtime guard, /_next auth bypass and occupied-port rejection.
- Production build, TypeScript, targeted ESLint and git diff --check passed.
  Build retains the existing warning about the parent package-lock outside Git.
- Laptop Chrome at the detected LAN URL: password eye, login, navigation and
  logout passed; 22 JavaScript chunk responses were 200, no ChunkLoadError or
  Server Action mismatch, no repeated /_next path, no old-address request, and
  browser Auth requests used detected-host port 54321. The HMR websocket at
  the detected host connected and received 46 frames.
- Physical phone unavailable; same-network phone connectivity is not claimed.
- LAN dev server restarted after the build with automatic discovery.

Changed: new discovery helper; local-dev-config and dev-local scripts; LAN and
Next runtime tests; LOCAL_SUPABASE documentation; explanatory Auth config comment;
this report. Existing uncommitted inactive-Member Attendance changes were retained.

## Route correction validation

Current Windows adapters: Wi-Fi 192.168.18.42, WSL vEthernet 172.20.176.1,
and loopback 127.0.0.1 (plus IPv6 addresses, excluded). The real UDP route probe
and shared resolver both returned 192.168.18.42 without an override. Browser
Supabase and development allowedDevOrigins derive from that exact resolved host;
no independent adapter enumeration occurs in Next configuration.

Full suite: 352 passed, zero failures/skips; production build, standalone
TypeScript, targeted ESLint and diff checks passed. Existing unrelated changes
were retained. No database/schema/dependency change was made.

After the route correction, the clean dev:lan restart printed the expected
192.168.18.42 app/API URLs. Laptop Chrome again passed password visibility,
login, navigation and logout; 22 chunk responses were 200, HMR received 46 frames,
and no request targeted the old address. No blocked cross-origin warning appeared
in the server log. Physical-phone testing remains unavailable.

## Public env / stale browser endpoint correction

Audit on the current files found .env.local pointing to the hosted Supabase URL,
.env.supabase.local to 127.0.0.1, and an empty .env.example URL placeholder. No
other root/parent env files or stale LAN override were present. No env file was
modified. The old address was embedded in generated artifacts:

- .next/dev/static/chunks/_03ez9_5._.js
- .next/dev/server/chunks/[root-of-the-server]__081-_z5._.js
- .next/dev/server/chunks/ssr/_0reryc8._.js

The running browser login failed before the clean restart. These compiled chunks
are the confirmed stale source; the historical process/env that originally
produced them cannot be reconstructed from current env files. It was not a
current .env.local URL override. Historical documentation/ignored QA artifacts
also retain the old address as listed above.

The browser client directly references NEXT_PUBLIC_SUPABASE_URL, allowing Next
to inline its startup value. The launcher already injects the resolved URL in
spawn's env before starting Next. Managed local Next now disables persisted
Turbopack dev filesystem cache and logs its own effective public URL. Also removed
a machine-specific address found in next.config.ts's dev-origin list; the resolved
launcher environment is its only LAN input. Production caching is unchanged.

Precedence: shell variables, then missing values from .env.supabase.local; the
launcher derives its browser URL and supplies the complete child env; Next uses
process.env before .env.development.local, .env.local, .env.development and .env.
No temporary runtime env file or duplicate browser URL setting was introduced.
Privileged Supabase remains verified loopback in both modes.

Real Chrome token requests after restart:

| Runtime / page origin | Password token endpoint |
| --- | --- |
| dev:lan / detected LAN | http://192.168.18.42:54321/auth/v1/token?grant_type=password |
| dev:lan / localhost | http://192.168.18.42:54321/auth/v1/token?grant_type=password |
| dev:local / localhost | http://127.0.0.1:54321/auth/v1/token?grant_type=password |

All three passed login, password visibility, navigation, logout, chunks and HMR;
no request targeted the old address. A real Next env-loader regression proves
launcher process env wins over a conflicting .env.local in both modes. Additional
tests ensure dev-cache disabling is managed-local only. Full tests/build/type/lint
results are recorded in the accompanying task response. A pre-existing /portal
uncached-data development diagnostic appeared during navigation; login completed
and the production build was checked separately. No auth/Suspense redesign was
made as part of this focused endpoint correction.
