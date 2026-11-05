# Local validation — 4 November 2026

## Result

A clean local rebuild completed successfully, including the finished baseline,
reference bootstrap and demo seed. Production was untouched: no hosted database
execution, export, migration repair, push, reset or history change occurred in
this implementation phase. The existing hosted `.env.local` was left unchanged.

Runtime: Docker Engine 29.9.2, Supabase CLI 3.0.0, PostgreSQL 17 local stack,
Node 26.13.0, Next.js 16.3.3. `db reset --local` is not a supported CLI 3 flag;
`db reset` explicitly reported target 127.0.0.1:54322. The pinned wrappers use
that default local target and reject additional target flags.

## Artifacts and equivalence

- Baseline: `supabase/migrations/20261104060000_current_state_baseline.sql`.
- All nine original filenames now live under `supabase/archive/pre_baseline/`;
  their original byte hashes match the capture manifest.
- Source `remote_schema.sql` byte hash is unchanged.
- 18 application tables, all 18 RLS-enabled; 11 application functions;
  37 policies; 24 explicit indexes, plus constraint-backed indexes.
- Two public triggers plus the verified origin-enabled Auth INSERT trigger.
- Function bodies, policy statements and explicit index definitions match the
  source dump (line ending normalization only). All constraints/columns/comments
  were retained through complete statement extraction; the clean rebuild
  validates their dependencies without disabling function checks.
- No Wedding schema; no platform object/extension recreation, OWNER statements,
  dump session switches, publication ownership or blanket default privileges.
- Built-in gen_random_uuid() exists locally; no pgcrypto addition was needed.
- Explicit application ACLs preserve the current model; restricted functions
  have explicit local revocations before approved grants.

No intentional application schema/behavior difference was introduced. Local
platform-managed objects, ownership provisioning and default privileges are not
claimed to match hosted infrastructure. Hosted schema currency was not rechecked
over the network in this implementation phase.

Archived paths (relative to the application root):

```text
supabase/archive/pre_baseline/20261011120000_manage_role_lifecycle.sql
supabase/archive/pre_baseline/20261011130000_create_wedding_records.sql
supabase/archive/pre_baseline/20261026090000_remove_wedding_records.sql
supabase/archive/pre_baseline/20261027090000_add_inactivity_configuration.sql
supabase/archive/pre_baseline/20261027100000_create_member_follow_ups.sql
supabase/archive/pre_baseline/20261029090000_add_reports_analytics.sql
supabase/archive/pre_baseline/20261031090000_harden_branch_authorization.sql
supabase/archive/pre_baseline/20261103100000_departments_and_permission_cleanup.sql
supabase/archive/pre_baseline/20261103110000_manage_service_types.sql
```

## Reference configuration

Every captured row and timestamp was compared against the local database.
Counts: 7 roles, 48 permissions, exactly 70 role-permission assignments, 5 hosted
service types, 4 hosted departments and 22 member-field definitions.

System administrator retains 33 grants, pastor 18, accounting 4, evangelism 5,
ministry 5, usher 3 and member 2. Old inactivity/follow-up defaults were not
restored for evangelism/ministry. Service-type names and active flags, hosted
department UUIDs/names, and dynamic-field configuration match the capture.

## Fixtures and scenarios

Verified counts: 2 demo branches, 30 members, 19 services, 44 attendance rows,
10 follow-ups, 20 contributions, 10 baptisms, 8 demo departments and 1 inactive
demo historical service type. Including captured reference data, departments
total 12 and service types total 6.

The live fixture rows were passed to the real inactivity calculator. Checks
passed for historical first attendance versus registration eligibility, Monday
versus midweek/Sunday starts, monitoring, three/four-week thresholds, attendance
reset, excused attendance and unknown eligibility. Inactive department/service
type historical relationships and archived member history were checked.

A local transactional follow-up insert left Member Status active; a deliberate
human status correction changed it to inactive. Both writes were rolled back.
Business-rule tests separately cover application action authorization and
historical integrity. Reports RPC returned expected follow-up/contribution totals.

Demo reseed passed after Auth setup and retained linked account lifecycle.
Seed now checks required service-type keys and preserves linked account status
and email. It still refreshes other fixture state and Manila-relative dates.

## Auth and application

Seven confirmed example.com accounts were created through Admin API; every
profile came from the real Auth trigger. Rerunning setup succeeded. Bagong is
linked to demo.member@example.com with connected status and accepted_at.

Real password login passed for all seven accounts. Authenticated role/branch
RPC checks matched their assigned scopes. A temporarily archived administrator
failed role and branch checks; that test was rolled back. Reports RPC denied
ordinary authenticated callers and succeeded through the local service client.

The built application ran against local Supabase. Thirteen authenticated HTTP
checks passed using real SSR Auth cookies:

- Admin: portal entry redirect, Members, Departments, Service Types, Reports.
- Pastor: portal entry redirect, Inactivity, Follow-ups, Services.
- Member: portal entry redirect, profile selector, linked profile detail, My Account.

These are server-rendering/redirect checks, not a visual browser acceptance
test. Interactive form submission, QR camera scanning, invitation email clicks,
password recovery, external address/AI integrations and every portal page were
not manually exercised. No UI screenshots were taken.

## Automated checks

- Production Next.js build passed, including TypeScript and 71 generated pages.
- Separate `tsc --noEmit` passed.
- Targeted ESLint on all new scripts and affected tests passed.
- `git diff --check` passed (Git noted normal LF→CRLF handling for the fixture).
- Full suite: **327 passed, 0 failed, 0 skipped**, with PostgreSQL suites enabled
  against disposable databases on the loopback local Postgres server.
- The departments integration fixture needed the real permissions UUID default;
  that fixture was corrected without changing its business assertions.
- Local URL rejection, remote-flag rejection, capture hashes, archived bytes,
  schema definitions, bootstrap SQL counts/order and secret-pattern checks pass.
- `.env.supabase.local` is ignored and contains only generated local credentials
  and a generated test password. Production credentials were not copied into
  implementation files.

To repeat validation after resetting and creating Auth accounts:

```powershell
npm run db:local:verify
# While the local application is running on port 3000:
npm run app:local:verify
# Optional PostgreSQL business-rule suites, disposable LOCAL databases only:
$env:UPC_AUTHZ_TEST_PG_PORT = '54322'
$env:UPC_ANALYTICS_TEST_PG_PORT = '54322'
$env:PGPASSWORD = 'postgres' # default disposable local password only
npm test
```

The local Supabase stack and built local app were left running for review.
The Auth password is in the ignored local env file; no password is committed.
