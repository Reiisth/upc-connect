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
Optional PSA_API_KEY/GEMINI_API_KEY integrations remain independent and can make
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

1. Find the laptop's Wi-Fi/Ethernet IPv4 using `ipconfig`.
2. Start local Supabase and run Auth setup with the loopback configuration.
3. Stop any existing Next.js process using port 3000.
4. Set `UPC_LOCAL_LAN_HOST` to that IPv4 and run `dev:lan`:

```powershell
$env:UPC_LOCAL_LAN_HOST = Read-Host 'Laptop private LAN IPv4'
npm run dev:lan
```

You can instead place `UPC_LOCAL_LAN_HOST=<your-private-IPv4>` in the ignored
`.env.supabase.local`. No machine address belongs in committed configuration.
Accepted hosts are RFC1918 IPv4 (10/8, 172.16/12, 192.168/16), IPv4 loopback,
or localhost. Supply only a host: URLs, credentials, ports, paths, public IPs
and hosted domains are rejected. LAN mode uses HTTP and the internal API port.

5. Open `http://<LAN-IP>:3000` from the phone. The launch message must show
   `Browser Supabase: http://<LAN-IP>:54321` (with the configured API port).
6. Confirm the API is reachable at that address from the phone. Next.js binds
   to 0.0.0.0; the validated host also configures its development-origin allowlist.
   If needed, allow the app/API ports on the laptop's private-network firewall.

On a phone, 127.0.0.1 refers to the phone itself, not the laptop. Only the Next.js
child process gets the browser-facing LAN URL. Its privileged server client
uses `UPC_LOCAL_INTERNAL_SUPABASE_URL`, set by the launcher to verified loopback.
That variable and SUPABASE_SECRET_KEY are server-only, never NEXT_PUBLIC values.
The development override is ignored in production. Setup scripts do not consume
the LAN host and remain strict even if the optional host is configured.

For LAN invitation/password-reset/OAuth redirects, locally add the explicit
`http://<LAN-IP>:3000/**` to `[auth].additional_redirect_urls` in
`supabase/config.toml`, keeping both localhost and 127.0.0.1 entries. Restart only
the local Supabase stack after changing Auth configuration; no reset is needed.
If testing flows that fall back to site_url, set its local value to
`http://<LAN-IP>:3000` too. Do not commit that machine-specific edit. Restore it
when switching back to laptop-only testing. We deliberately avoid a broad host
wildcard: Supabase redirect globs do not validate private IP subnet membership.
Password login with the confirmed demo accounts needs no redirect-list change.
See [Supabase redirect URL rules](https://supabase.com/docs/guides/auth/redirect-urls).

Browser camera/QR and some PWA features require a secure context; HTTP on a LAN
IP may not support them. This mode addresses connectivity/login testing.
