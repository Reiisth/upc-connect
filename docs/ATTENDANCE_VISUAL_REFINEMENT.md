# Attendance visual refinement and comparisons

November 7, 2026. Supersedes the chart palette and custom scanner header described
in ATTENDANCE_SCANNER_UX.md. KPI definitions, filter behavior and authorization
remain unchanged. No migration, dependency or environment change is required.

## Charts

Attendance opts into the shared chart wrapper's refined appearance. Present uses
existing brand blue #365FA6; supporting series use #8BAFE5 and neutral #CBD5E1.
The previous forced green/red/yellow chart palette is removed. The line retains
Present counts, with a monotone curve, small points and a transparent blue area.
Horizontal gridlines and axis labels are lighter. Stacked bars have rounded
corners, and the donut has an 80% cutout with its record total in the center.
Legends, category labels, exact-count tooltips and accessible data tables remain.
The plot stays 220px high. Other callers retain their default appearance.

Chart switching is unchanged: no date gives a line; selected date and one effective
authorized branch gives a donut; selected date and multiple branches gives stacked
bars. One authorized branch under All Branches still names the actual branch.

## Comparison rules

Latest Service Attendance compares the total of all three recorded statuses with
the immediately preceding attendance-bearing qualifying Service in the same
effective host-branch scope. Order is Service date descending, start time descending
(nulls last), then ID descending. Scheduled, Cancelled and empty Services are
excluded. With a selected date, the current Latest must occur on that date;
its predecessor may be earlier that day or on an earlier date. Under All Branches,
this remains a comparison of two individual Services across the authorized scope,
consistent with the existing Latest KPI; it is not a combined daily total.

Average compares Present-per-qualifying-Service values using adjacent equal-length
calendar-day windows. The overview remains the first of the month five months ago
through Manila today; the comparison is the same number of days immediately before
that range. For example, June 1-November 7 is 160 days, compared with December 23-
May 31. A selected date compares with the preceding calendar day. A day with no
qualifying Services is unavailable, not zero attendance. Zero-record qualifying
Services remain in both denominators. Percentages use unrounded averages and round
the resulting percentage to one decimal place; displayed KPI rounding is unchanged.
These are descriptive comparisons, without a claim of equivalent service mix.

The subtle tickers show direction icons, percentages and comparison labels; their
accessible text spells out up/down/unchanged. Missing current or previous values
show No previous comparison. A zero baseline with a nonzero current value shows
Previous value was 0; zero versus zero shows 0%. No division by zero, Infinity,
invented 100% increase or fabricated membership trend is used. Total Members stays
the current non-archived home-branch population, independent of Dashboard Date.

Queries remain server-side and authorized. The loader pages scoped Service metadata,
uses exact head counts in batches, and finds the two latest attendance-bearing
Services with the existing bounded inner-existence selection. The browser receives
comparison numbers, not Attendance histories. Separate requests can observe
concurrent edits; refreshing recalculates the snapshot.

## Scanner template

The page uses the actual shared PageHeader with Attendance eyebrow, explicit Back
to Service Attendance route, QR Attendance Scanner title and helper text. Mobile
spacing and title size are compact overrides on the shared component. Service
identity and status remain content below the canonical header. The square scanner,
desktop kiosk/mobile operator instructions, feedback and compact recent QR list
are preserved. Guides use border-primary, resolving the existing --primary token;
success, duplicate and error feedback retain their useful semantic styles.
No manual QR entry is present. QR server validation was not modified by this task.

## Files

- lib/attendance-dashboard-model.ts: blue palette and safe comparison contract/helper.
- lib/attendance-dashboard.ts: previous-Service and preceding-period queries/counts.
- app/portal/attendance/AttendanceMiniDashboard.tsx: two accessible subtle tickers and refined chart appearance.
- app/portal/reports/ReportChart.tsx: opt-in area fill, lighter grids, rounded bars and thinner donut.
- app/portal/attendance/[serviceId]/scan/page.tsx: canonical shared PageHeader and compact mobile spacing.
- app/portal/attendance/[serviceId]/scan/QrAttendanceScanner.tsx: primary-blue target guides.
- tests/attendance-dashboard.test.cjs: comparison edge cases, scoped queries, chart options and actual PageHeader rendering.

Existing uncommitted scanner work from the preceding task was preserved.

## Verification

Full test command: 342 passed, zero failed; six optional PostgreSQL suites skipped
because disposable database ports were not configured. Focused tests cover previous
Services, scope, lifecycle exclusions, preceding ranges, missing/zero baselines,
current Members, chart modes/options, blue palette and canonical scanner header.
TypeScript, targeted ESLint, production build and git diff --check passed.

Local Chrome verified no-date blue area and exactly two tickers; date/all-branch
stacked bars; date/single-branch donut; missing comparison fallback; and correct
33.3% decrease and 100% increase against temporary known records. Scanner QA used
real ZXing decoding from a synthetic camera stream: Present recording, named
Visiting Member feedback, immediate recent entry and friendly duplicate with one
database record. Desktop 1360px, tablet 768px and mobile 375px retained a square
camera without horizontal overflow. Screenshots were inspected. Temporary local
QA Attendance/Services were removed. Physical camera/device testing remains outside
this synthetic-camera check. LAN development was restarted after the build.
