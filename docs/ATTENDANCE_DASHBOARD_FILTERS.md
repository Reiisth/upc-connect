# Attendance dashboard filters

Implemented 2026-11-06. This supersedes the Attendance definitions in
MODULE_MINI_DASHBOARDS.md; Baptisms and Contributions retain their existing behavior.

## Cards and scope

- Latest Service Attendance: Present records only in the
  latest attendance-bearing qualifying Service, with its name, date, host branch
  and status breakdown. No matching Service displays Unavailable.
- Average Attendance: Present rows divided by qualifying Services, including
  Services with zero records. Zero qualifying Services displays Unavailable.
- Total Members: current non-archived Members in the selected home branches,
  including inactive Members. Selecting an old date does not reconstruct history.

Qualifying Services are effective Ongoing or Completed, using the existing
lifecycle helper. Scheduled and Cancelled Services are excluded. Attendance is
attributed to the host Service branch, independently of Member home branch.
Absent counts come exclusively from stored Absent rows.

Branch selection scopes both the dashboard and operational lists. Dashboard Date
is independent of the existing operational Service date filter, so selecting a
historical dashboard date leaves current Ongoing/Upcoming Services visible.
Every refresh rechecks attendance.view and authorized active branch scope.

## Automatic chart selection

| Context | Chart | Aggregation |
| --- | --- | --- |
| No date, any branch scope | Present line | Six calendar months through Manila today |
| Date, all authorized branches | Stacked bars | One host-branch bar, Present/Excused/Absent |
| Date, one branch | Donut | All qualifying same-day Services, total records in center |

Without a date, the average uses the displayed recent window; Latest searches
through today, including older attendance-bearing Services. With a date, both
use that exact Service calendar date. Service dates are stored DATE values;
check-in UTC timestamps do not shift attendance into another reporting day.
Latest ties use Service date, start time, then ID deterministically.

Empty charts show an explicit message instead of a zero donut. Labels, tooltips
and the existing accessible chart-data table supplement color. Chart height is
220px. Three cards wrap on mobile; branch selection occupies a full mobile row.
Loading hides stale-context data; failed refreshes offer Retry, and outdated
responses cannot overwrite a newer selection.

## Query and implementation

The server loads paginated, branch/date-scoped Service metadata and requests
exact SQL head counts for statuses in Service-ID batches. It does not download
attendance histories or Member details into the browser. Latest lookup uses an
inner attendance existence selection limited to one opaque ID per candidate,
with candidate pagination, then status counts for the selected Service.
Member population uses an exact head count against current non-archived Members.
Separate count requests can observe concurrent edits; refreshing recalculates.

Changed files:

- lib/attendance-dashboard-model.ts: response contract and chart-mode selection.
- lib/attendance-dashboard.ts: scoped server queries and aggregation.
- app/portal/attendance/dashboard-actions.ts: authorized filter refresh.
- app/portal/attendance/AttendanceMiniDashboard.tsx: filters, three cards, chart.
- app/portal/attendance/page.tsx and AttendanceServicesTable.tsx: integration and
  shared branch state, separate dashboard date.
- app/portal/reports/ReportChart.tsx: optional stacked and donut support; existing
  callers retain their defaults.
- tests/attendance-dashboard.test.cjs and services-attendance.test.cjs: coverage
  and count-aware transport support.

No migrations, dependencies, environment changes, recording authorization,
lifecycle rules, QR behavior, Member eligibility or baseline changes.

## Verification

All 373 tests passed, including 11 dashboard tests covering scope, dates,
Present-only averages, empty Services, recorded statuses, cross-branch hosting,
Manila dates, authorization, chart modes, pagination and large Service scopes.
Production build, TypeScript, targeted ESLint and git diff --check passed.

Local Chrome browser scenarios A-G passed using temporary local historical
Services with multiple Services per branch and cross-branch Members. Counts
matched exact database counts, historical Dashboard Date left the Ongoing list
unchanged, and empty dates retained current Member population. Temporary QA
Attendance and Services were removed. Desktop 1360px, tablet 768px and mobile
375px checks had no horizontal overflow or browser errors. This was responsive
browser emulation, not a physical-phone test.
