# Returning inactive Members: attendance correction

Validated locally on 2026-11-05. This supersedes the inactive-attendance exclusion
and pending product decision recorded in the original Phase 2L report.

## Rule and implementation

Previously new Attendance required stored Member Status Active. New manual and
QR Attendance now accept **Active or Inactive, non-archived Members**, from any
home branch. Missing/unsupported status remains ineligible. Archived Members
remain excluded. Historical correction rules remain unchanged.

Both write actions independently enforce that rule. The home-branch eligible
roster and focused church-wide identity lookup use the same Active/Inactive
filter. Lookup returns the actual administrative status instead of hardcoding
Active; identity fields remain minimal. Inactive Member labels appear in the
manual selector, recorded table and QR feedback, alongside existing home-branch
and Visiting Member context.

Recording still requires attendance.record, active-account checks, access to the
host Service branch and the existing Service lifecycle. Member home-branch access
is unnecessary. Attendance writes do not update Members, create status decisions,
change archive state, or transfer branch assignment. The existing Review Member
Status / Member edit flow remains the manual reactivation path.

No schema or migration was needed: existing constraints/RLS do not require active
Member Status. The baseline, RBAC, Contributions, Gemini and Service lifecycle
are unchanged. Contributions already allow inactive non-archived Members.

The inactivity calculator already reads physical Present/Late attendance without
an administrative status filter. Home-branch eligible weeks, registration rules,
thresholds and any-branch participation remain intact. Reports already count
historical attendance by host Service without filtering current Member Status.
Neither architecture required modification.

## Fixture and validation

Reused **Rosa H. Bautista**, North branch, Inactive and non-archived, as the
Inactive Member Returns fixture. See [DEMO_DATA.md](DEMO_DATA.md). Seed SQL and
fixture counts did not change; no local reset was performed. Local Auth setup
completed for all seven fictional demo accounts.

Real Chrome at the local app, with a mobile viewport and North-only usher:
selected Rosa with the Inactive Member label, saved Present, confirmed visible
attendance and compared Member Status, home branch, archive state and updated_at
before/after. All Member fields remained unchanged. Only the QA-created attendance
row was removed afterward; existing records were preserved.

- Full tests with disposable local PostgreSQL databases: **347 passed, zero
  failed, zero skipped**. Coverage includes inactive home/cross-branch manual/QR
  writes, host-only authorization, unchanged membership, lookup/UI eligibility,
  archive exclusion, historical visibility, Present/Late inactivity and Reports,
  and unchanged Contribution behavior.
- TypeScript, targeted ESLint, production build and git diff --check passed.
- The build printed the existing parent-directory package-lock warning; Cache
  Components and Suspense behavior remain intact.
- Hosted Supabase was not targeted. No dependencies were added.

## Changed files

- app/portal/attendance/actions.ts, data.ts, types.ts, AttendanceView.tsx,
  [serviceId]/scan/QrAttendanceScanner.tsx and README.md.
- tests/services-attendance.test.cjs, inactivity-server.test.cjs and
  analytics-postgres.test.cjs.
- docs/DEMO_DATA.md, PHASE_2L_CROSS_BRANCH.md and this report.
