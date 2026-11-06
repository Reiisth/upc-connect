# Baptism Records dashboard refinement

Implemented November 7, 2026.

The three existing dated-record cards now have larger numbers and color-coded
comparison tickers, matching Contributions. Dated Baptism Records, Water Records
and Holy Ghost Records compare with the immediately preceding equal-length
calendar-day period in the same authorized stored-record branch scope. Missing
history uses No previous comparison; zero baselines do not fabricate percentages.
Counts represent records, not distinct people: a Member can have both types.

Baptisms Over Time is a two-series monthly line chart: Water in blue and Holy
Ghost in purple. Each series uses independently counted stored baptism types,
with zero-filled missing months and year labels across years. Legends, tooltips
and the accessible chart-data table identify both series. A range covering only
one month naturally shows one point per series. Undated records are excluded
from dated metrics and chart buckets rather than assigned invented dates.

The Date range title is fully inside its card. Presets are Recent 12 months,
This month, Last 30 days, Year to date, All time and Custom range. From/To fields
sit side by side on mobile, with Apply range below. Applying updates cards,
charts and table together; invalid or failed requests retain the applied context.
The default retains the existing 12-month overview, now also applied to the
table. All time includes undated table records labeled Date unknown while keeping
them outside dated metrics; the dashboard still notes undated scope-wide counts.

Branch sits beside search on wider screens and stacks on mobile. Search and
baptism-type filters affect the table; Branch affects both table and dashboard.
Clear filters preserves the applied range. Pagination uses at most ten records,
Previous/Next, page totals and a showing-count; filters/range changes reset page 1.

Water rows use Droplets with a blue treatment; Holy Ghost uses Flame with an amber
treatment. The baptism-type text badge remains. Member names now show only the
baptism date beneath them; old status/history details and notes were removed from
that cell. The separate Baptism Date column was removed. Historical linkage and
type-specific correction authorization are unchanged.

## Data and migration

New additive migration:
`supabase/migrations/20261107100000_baptism_summary_series.sql`.
It adds service-role-only get_baptism_module_summary, reusing the existing totals,
undated and breakdown definitions and replacing the combined monthly trend with
Water/Holy Ghost counts. Stored record branch/date determine attribution; there
is no current Member roster join and no change to Baptism eligibility or history.
The server action rechecks baptisms.view and historical branch access on each
range refresh. Current and previous aggregates use identical authorized branches.
The client receives aggregate counts, without downloading identities for charts.

The migration was applied locally using Supabase migration up --local. No reset,
Auth setup, seed modification, dependency or environment change was necessary.
The clean-schema verifier now expects 16 public functions; all other counts are
unchanged. LAN development was restarted after the production build.

## Changed files

- app/portal/baptisms/BaptismsTable.tsx: range controls, Branch/search layout, paging, icons and date-under-name rows.
- app/portal/baptisms/dashboard-actions.ts: authorized range refresh.
- lib/module-summary.ts: typed Baptism summary and preceding-period comparisons.
- components/module-summary.tsx: two line series, three count tickers and selected-range month buckets; Contributions behavior preserved.
- supabase/migrations/20261107100000_baptism_summary_series.sql: read-only typed aggregation function and execution ACLs.
- scripts/verify-local-db.mjs: additive public-function count.
- tests/baptism-dashboard.test.cjs, baptisms-history.test.cjs, module-summary.test.cjs and table-filter-ux.test.cjs: data, UI, historical visibility and updated seven-column coverage.

## Validation

Full suite: **405 passed, zero failed, zero skipped**, with optional PostgreSQL
suites enabled. Real SQL checks verify typed trend totals, branch scope, empty
results and function permissions. Unit tests cover authorization, range comparison,
independent Water/Holy Ghost values, zero months, tickers, icons, date layout and
ten-row pagination. TypeScript, targeted ESLint, production build and diff checks
passed.

Local Chrome verified two distinct monthly series against known records, three
tickers (200% growth across all branches, 100% for North), stored-branch filtering,
page navigation/reset, visible date-under-name, absence of the date column/notes,
invalid-range preservation and All time's undated records. Desktop and 375px
screenshots were inspected; mobile had no horizontal overflow. Only temporary QA
baptism rows were removed after testing; existing records were preserved.
