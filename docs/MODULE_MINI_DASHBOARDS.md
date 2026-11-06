# Compact operational module summaries

Implemented locally on 2026-11-06 for Attendance, Baptisms and Contributions.

| Page | KPIs | Primary chart | Secondary chart | Period |
| --- | --- | --- | --- | --- |
| Attendance | Attendance records, physical check-ins, average physical check-ins per completed Service | Monthly physical attendance, line | Present / Late / Excused records, horizontal bars | Six calendar months through today |
| Baptisms | Dated records, Water records, Holy Ghost records | Monthly baptism records, bars | Water / Holy Ghost records, horizontal bars | Twelve calendar months through today |
| Contributions | Total received, contribution records, average amount | Monthly amounts received, bars | Amount by Member / Visitor / Anonymous, horizontal bars | Six calendar months through today |

Periods start on the first of the earliest month and end on the current Manila
calendar date. They are printed explicitly above the cards. The final month is
partial. The longer baptism window accommodates low-volume historical events.
Undated baptism records are counted separately as a scope-wide history note and
never assigned a fabricated event date. Types describe records, not disjoint
populations of people; a Member may have both baptism types.

## Scope and definitions

Each dashboard shares its table's existing branch-selector state. All accessible
branches is the default; selecting one branch immediately switches the cards and
both charts to that branch's precomputed aggregates. Other operational filters
(search, table date controls, type/status/payment headers) affect the table only,
as explicitly stated above the dashboard. No report date-range builder was added.

Attendance uses completed Services and their stored branch/date. Present + Late
are physical attendance; Excused contributes only to recorded status/count. There
is no inferred Absent population, attendance percentage, or current Member-roster
join. Inactive and visiting Members count normally at the host Service. Empty
completed Services contribute zero check-ins to the average denominator. A
service/member pair is counted once, agreeing with Reports' deduplication; for
legacy conflicting duplicate statuses the summary favors Present, then Late,
then Excused. The existing database unique constraint prevents normal duplicates.

Contribution amounts belong to the stored receiving branch, including gifts
from Members with another home branch. The explicit contributor_type determines
the breakdown; null member_id is never interpreted as Anonymous. SQL NUMERIC
SUM/AVG is rounded to cents and serialized as decimal strings. Existing Reports
formatters preserve exact values; Chart.js uses existing relative-money
coordinates with a labeled relative axis and exact tooltip/data-table amounts.
No donor names, visitor names or private Member details enter chart props.

## Query and migration audit

Existing operational list loaders already fetch their records for the tables.
This change does not add raw-row downloads to calculate dashboards. The server
loads aggregate-only data after each page's existing module view permission and
branch-scope resolution; it does not require reports.view or broaden RBAC.

The Reports RPC lacks both recorded attendance-status and contributor-category
breakdowns. Replacing it or loading full histories into JavaScript would conflict
with this task's requirements. Therefore one small additive migration was needed:
`supabase/migrations/20261106090000_module_summaries.sql`. It creates only
`get_module_summary(module, branch_ids, from, to)`, a read-only STABLE function.
It performs scoped SQL aggregation with branch/global grouping sets and monthly
series. Only service_role may execute it; PUBLIC, anon and authenticated are
explicitly revoked. Callers must validate the module permission and branch IDs.
No table, historical row, baseline, RLS policy or existing Reports RPC changed.

The selected module alone is queried; SQL materializes its scoped source once.
Attendance joins only records for the selected completed Services. Financial and
baptism sources use their existing receiving/stored branch and date fields.
Responses contain compact totals/month/category rows for authorized branches and
their global rollup. The browser selects already authorized aggregates; no
per-filter server request or new personal-data lookup is needed.

The migration was applied only to local PostgreSQL without resetting demo data.
The local schema verifier's function count was updated from 11 to 12. Apply the
additive migration alongside these application changes before using the pages on
another environment. No hosted database was targeted.

## Presentation and empty states

Existing page-level cards were replaced, rather than duplicated. A shared
ModuleMiniDashboard renders three small cards and the existing Reports Chart.js /
react-chartjs-2 wrapper with an optional compact presentation. Reports keeps its
default presentation. Both chart canvases are 220px high. Desktop uses 2:1 columns;
table controls follow immediately. There are no hero graphics or Gemini panels.

At smaller widths the primary chart remains visible and the secondary breakdown
is behind a small Show/Hide control, so reaching operational actions does not
require scrolling through two stacked charts. Cards wrap without page overflow.
Expanded breakdowns stack normally. Shared Card, typography, border, radius,
spacing and empty states remain in use. Charts show an explicit no-activity
message for zero data; monthly zero slots provide consistent ordering for sparse
or one-month activity. Accessible View chart data tables preserve exact values.

## Validation and changed files

- SQL regressions compare overlapping totals with the existing Reports RPC for
  single and combined branch scopes. They cover Present/Late/Excused, legacy pair
  deduplication, status/transfer independence, Water/Holy Ghost/undated records,
  exact receiving money, Visitor/Anonymous distinction, empty scopes and RPC ACLs.
- Loader tests verify authorized branch parameters, period construction, empty
  access and sanitized failures. UI tests cover sparse/empty chart inputs and
  large exact-money formatting. Existing historical/operational regressions run
  with the additional RPC transport mocked at the existing harness boundary.
- Browser checks visited all three pages at 375px, 768px and 1360px, changed branch
  filters and expanded mobile breakdowns. No page-level horizontal overflow or
  browser errors occurred. Screenshots are retained locally in ignored
  `supabase/.temp/mini-{module}-{width}.png`. Physical-phone testing was not used.
- Full suite: **357 passed, zero failed, zero skipped**, with local PostgreSQL
  suites enabled. Production build, standalone TypeScript, targeted ESLint and
  git diff --check passed. The local database verifier confirmed 47 attendance
  records, 23 contributions, 10 baptisms and all 70 captured role-permission
  assignments remained unchanged. The existing parent package-lock build warning
  remains. The LAN dev server was restarted for review.

Changed files: the three module page components and table components; new
`components/module-summary.tsx` and `lib/module-summary.ts`; optional compact mode
in `app/portal/reports/ReportChart.tsx`; the additive migration; local schema
verifier; module-summary tests and historical-record harness; this document.

Operational CRUD/actions, permissions, Service lifecycle, Member Status and
inactivity rules, contributor model, Baptism permissions and Gemini are unchanged.
