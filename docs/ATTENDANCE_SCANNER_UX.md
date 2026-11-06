# Attendance dashboard and scanner refinement

The chart palette and outer scanner header have since been revised. See
[Attendance visual refinement](ATTENDANCE_VISUAL_REFINEMENT.md) for current styling,
comparison ticker rules and the canonical PageHeader. Other scanner behavior below
remains applicable.

Implemented November 7, 2026. No migrations or dependencies added.

## Dashboard

The old chart selector equated the All Branches filter with multiple branches.
It now receives the effective authorized branch count: no date gives a line;
a selected date with one effective branch gives a donut; more than one gives
stacked branch bars. Explicit branch selection has one effective branch. An
All Branches user with one authorized branch sees that branch's actual name in
the dashboard context and donut description. Empty scopes retain an empty state.
Authorization and all KPI definitions are unchanged.

Attendance Present uses #B0F2B4, Excused #5D94E8, Absent #EF476F. Warning feedback
uses #FFC43D; no warning chart category is invented. The Present line uses the
requested base color with a darker #397B45 stroke for contrast. Labels, legends,
tooltips and the accessible data table remain available. Chart color overrides
are optional, preserving existing Reports and other module defaults.

## Scanner

The authorized server page now prioritizes Service identity, Ongoing badge,
instructions and camera. Desktop has a centered scanner up to 576px wide with
large named feedback. Mobile uses a shorter instruction, full usable content
width and compact Service context. One shared scanner implementation drives both.
The camera is square, with transparent corner guides and no manual text input,
hidden fallback field or manual submit button.

Coarse-pointer devices prefer the environment camera; desktop prefers the user
webcam. Constraints are preferences, allowing the browser to fall back. Camera
permission denial, missing devices, busy cameras, initialization errors and
insecure origins have useful messages and Retry. LAN camera use still requires
a browser-trusted secure context; LAN URL discovery and privileged loopback
configuration are unchanged.

Server validation remains authoritative: attendance.record, current host branch
scope, effective Ongoing status, recognized Member, active/inactive eligibility,
archive exclusion and duplicate uniqueness. QR always records Present. Database
errors in the QR mutation are replaced with user-facing messages. No Member
status, home branch or lifecycle mutation is introduced.

Feedback shows name, Present recorded or Already Scanned, and Visiting Member
with home branch when applicable. It clears after 2.8 seconds without Reset.
Only one mutation can be in flight; the same QR is suppressed for four seconds,
while a different Member can scan as soon as the previous request finishes.
Existing uniqueness and concurrent-insert handling remain in place. Inactive
administrative status is not shown in the kiosk. Sound/haptics were considered
optional and omitted; no browser permission or autoplay requirement was added.

Recently Scanned is truthful QR-only history: method=qr, current Service, latest
20 records ordered by creation time and ID descending. Manual records are
excluded. Initial history is loaded server-side after Service authorization.
Successful mutations return an opaque record key, display name, attendance
status/time and branch context; the client prepends the sanitized result and caps
the list at 20 without refetching a roster. No contact details or full Member
profile is returned. Duplicate scans leave the list and existing status intact.
The list is a snapshot plus this scanner's successes, not a realtime feed from
other operators. Camera controls and feedback timers stop on unmount.

## Changed files

- lib/attendance-dashboard-model.ts: effective-count chart rule and palette.
- app/portal/attendance/AttendanceMiniDashboard.tsx: effective branch label and colors.
- app/portal/reports/ReportChart.tsx: optional donut colors and line contrast.
- app/portal/attendance/[serviceId]/scan/page.tsx: compact authorized Service header and initial history.
- app/portal/attendance/[serviceId]/scan/QrAttendanceScanner.tsx: camera presentation, cooldown, feedback and recent queue.
- app/portal/attendance/data.ts: bounded current-Service QR history query.
- app/portal/attendance/actions.ts and types.ts: minimal record identity and sanitized database errors.
- tests/attendance-dashboard.test.cjs and services-attendance.test.cjs: effective scope, palette, scanner markup, minimal history/result and invalid QR coverage.

## Validation

The full test command passed: 337 passes, zero failures, six optional PostgreSQL
suites skipped because disposable database ports were not configured. Existing
tests cover lifecycle restrictions, unauthorized scope, duplicate insert races,
cross-branch scanning, inactive acceptance and archive rejection. New tests cover
effective single-branch All Branches, actual branch description, semantic colors,
camera-first markup, no manual input, minimal QR result and bounded QR-only history.
Production build, TypeScript, targeted ESLint and git diff --check passed.

Local Chrome used the actual ZXing decoder with a synthetic camera stream
containing a registered cross-branch Member QR. Verified Present insertion,
named confirmation, Visiting Member tag, immediate recent-list update, duplicate
feedback and exactly one database record. Permission denial and Retry passed.
The single-branch Usher's All Branches dashboard rendered a donut naming the
actual North branch. The multi-branch dashboard regression scenarios also passed.
Desktop 1360px, tablet 768px and mobile 375px were square with no horizontal
overflow. Temporary local Service and Attendance rows were removed. This tests
real decoding and server mutations, but does not substitute for physical webcam,
rear-camera or phone permission testing. LAN development was restarted after build.
