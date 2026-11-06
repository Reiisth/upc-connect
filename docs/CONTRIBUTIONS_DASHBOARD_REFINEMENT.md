# Contributions dashboard refinement

November 7, 2026.

All three cards now have the same larger, color-coded comparison treatment as
Attendance: Total Received, Contribution Records and Average Contribution.
Green/up and red/down indicate direction; equal/unavailable comparisons are
neutral. The comparison is the immediately preceding range with the same number
of inclusive calendar days and the same receiving-branch scope. Missing previous
records show No previous comparison; a nonzero value against zero shows Previous
value was 0 rather than an invented percentage. Comparisons describe changes,
without a claim of equivalent giving patterns or seasonal service mix.

The existing PostgreSQL summary RPC still computes exact sums and rounded
averages as decimal strings. Current/previous comparisons use BigInt decimal
units, rounding percentages to one decimal place. Money is never summed or
divided using JavaScript binary floats. Only chart plotting converts amounts to
numeric coordinates; card values, tooltips and data tables preserve exact strings.

Both Contributions charts now use absolute PHP amounts. Their numeric axes say
Amount (PHP), use peso tick labels and scale to actual amounts, including cents.
The relative percentage axis and explanatory relative-amount note are removed
from these charts. Other ReportChart callers retain the prior default unless
they explicitly request the absolute money scale.

## Date range

The visible Date range fieldset contains Period, From, To and Apply range.
Presets include Recent 6 months, This month, Last 30 days, Year to date, All time
and Custom range. From/To sit side by side on mobile; Apply is full width. All
time resolves dates from the already authorized records list, including a later
recorded date if one exists. The initial period remains recent six calendar
months through Manila today.

Apply updates cards, both charts and table records together. Consequently the
initial records list now shares the displayed recent-six-month range rather
than showing all historical records under six-month dashboard totals. Choose All
time to include the entire authorized record history. Invalid/reversed ranges
show a clear message without replacing applied data. Failures preserve the
previous applied range and aggregates. Branch filters continue to scope cards,
charts and table; search/type/payment filters remain table filters. Clear filters
preserves the chosen date range, as before.

Each range refresh rechecks contributions.view and resolves authorized historical
receiving branches on the server. It then fetches current and preceding summary
aggregates with identical branch IDs. No new RPC, schema, dependencies, financial
mutation or permission change was needed. Two separate aggregate reads may
observe concurrent edits; applying again refreshes the snapshot. Monthly buckets
cover the actual chosen range, including partial first/last months and missing
months as zero; labels include years for ranges spanning years.

The dollar icon beside contributor names is removed. Contributor identity,
Member/Visitor/Anonymous distinctions and historical receiving-branch rules are
unchanged.

## Changed files and validation

- app/portal/contributions/ContributionsTable.tsx: visible applied date range, responsive controls, scoped dashboard updates and icon removal.
- app/portal/contributions/dashboard-actions.ts: authenticated range refresh using existing branch access.
- lib/module-summary.ts: optional validated range and preceding-period aggregates for Contributions.
- lib/contribution-comparison.ts: exact decimal comparison arithmetic and fallbacks.
- components/module-summary.tsx: three contribution tickers and range-aware absolute charts; other module defaults preserved.
- app/portal/reports/ReportChart.tsx: optional absolute PHP plotting/axes with exact tooltip/table values.
- tests/contribution-dashboard.test.cjs and module-summary.test.cjs: arithmetic, authorization, scope, ranges, chart options, accessible labels and existing module regressions.

Full suite: **401 passed, zero failed, zero skipped**, with PostgreSQL suites
enabled. Production build, TypeScript, targeted ESLint and git diff --check passed.
Local Chrome checked exact totals/averages, three tickers, receiving-branch
filtering, applied range consistency, presets, invalid range preservation, no
dollar icons, and no overflow at 375px. Desktop/mobile screenshots were inspected.
Temporary QA financial rows were removed. LAN development was restarted after build.
