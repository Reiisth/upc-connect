# Member migration tracking

Tracking starts when `20261116090000_member_migrations.sql` is applied. Apply
`20261116091000_member_migration_analytics.sql` immediately afterward, before
deploying the application. These additive migrations do not backfill or infer
earlier branch changes. The tracking start timestamp is displayed in analytics.
No production database is changed by the application implementation or tests.

## Operations

- Saving a different Church Branch records a transfer automatically, in the same
  transaction as the church-information update. The date is the database clock,
  not an editable effective date. First assignment of a previously unknown branch
  is an administrative repair, not a migration.
- **Record Departure** is a separate, confirmed operation. It records departure
  and sets `departed_at`, `is_archived`, and `archived_at` atomically. Keeping the
  last branch preserves existing branch-scoped archive/restore access. Archiving
  excludes the departed member from existing current operational selectors and
  blocks profile editing, without archiving their linked account.
- Ordinary **Archive Member** and administrative Active/Inactive changes do not
  imply departure. Restoring a departed member records a return to their last
  branch, clears departure/archive markers, and preserves administrative status.
  Staff should review that status after restoring. To return to another branch,
  restore first, then transfer; both real actions are retained in history.
- Retrying or concurrently submitting an outdated movement fails without a
  duplicate event. A history write failure rolls back the member update too.
- No event editing, deletion, manual insertion, backdating, or reason field is
  exposed. Authorized database-owner maintenance remains possible; application
  roles have no direct event-table writes. Member/branch deletion is restricted
  by historical foreign keys. Actor deletion may clear its reference.

Attendance, contributions, baptisms, follow-ups, account links and profile fields
are not rewritten by membership movement. Inactivity retains its existing
current-branch model; this feature does not reconstruct historical rosters.

## Permissions and visibility

- Transfer: existing `members.update`, current member scope and both active
  branches. Only a system administrator with permission may repair an unassigned
  member. Departure/return: existing `members.archive` and active current branch.
- The service-only `change_member_membership` RPC locks the member and verifies
  active account, active permission/role, branch scope, current state, expected
  branch, and field allowlist again. Database triggers prevent raw API branch or
  departure-marker updates from bypassing the workflow.
- `/portal/members/migrations` and `/portal/members/[memberId]/migrations` require
  `members.view`. Visibility follows the event's original source/destination,
  independent of the current member branch. They expose snapshots of name/branch
  at movement time, never the member's current personal profile from another
  branch. Counterpart branches outside actor scope are masked. Inactive branches
  remain available to assigned historical viewers and system administrators.
- `/portal/reports/migrations` requires `reports.view`. Its service-only aggregate
  RPC repeats account/permission/scope checks and returns no member identities.
  The existing Reports page links to analytics; Members links to the register.

## Reporting definitions

Date filters use inclusive Asia/Manila days. Cards, trend, branch totals and routes
share the same SQL-filtered events. Grouping supports daily, weekly and monthly
periods. Reporting ranges are limited to 3,660 days.

- Transfer events count each transfer once; distinct members count each person
  once across all selected movement types. Repeated moves remain separate events.
- In/out are relative to the selected branches. A transfer inside the selection
  counts once in and once out, so contributes zero net movement.
- Departures leave the church entirely; returns reverse that boundary crossing.
- Net movement = transfers in + returns − transfers out − departures. It excludes
  new registrations and is not total membership growth or a retention rate.
- Periods before tracking started are explicitly incomplete, not historical zero
  movement. Date and branch filters are retained in URLs and pagination links.

## Validation

`tests/member-migrations.test.cjs` covers server permissions, trusted scope,
combined filters, masking, explicit departure confirmation, and self-service
tamper rejection. `tests/member-migrations-postgres.test.cjs` creates and drops
its own disposable database when `UPC_MIGRATION_TEST_PG_PORT` is set. It checks
real migrations, atomic logging/rollback, permissions, Manila boundaries, net
accounting, and concurrent duplicate departures. Never point it at production.
