# Attendance and Service lifecycle revamp

Implemented and validated locally on 2026-11-06. This supersedes earlier Phase 1C
and Phase 2L lifecycle/status descriptions. Hosted Supabase was not targeted.

## Attendance values and migration

Previously valid Attendance values were Present, Late and Excused. They are now
**Present, Excused and explicitly recorded Absent**. Present alone is physical
participation. An eligible current-roster Member without a row remains **No record
(current roster)**, separately counted/filtered; no absence is invented by
subtracting a roster from recorded check-ins.

The local audit before reset found 44 Present, 2 Late and 1 Excused rows. New
additive migration `20261106100000_attendance_lifecycle.sql` drops the old CHECK,
updates Late to Present, installs the Present/Excused/Absent CHECK, and replaces
the Reports/module aggregation function definitions with Present-only physical
predicates. The operation is transactional. No history row is deleted or
reassigned. A disposable PostgreSQL test verifies row-count preservation,
backfill, rejection of the removed value and acceptance of Absent.

The baseline and earlier migrations remain unchanged. Historical migrations and
the conversion/regression tests necessarily retain the removed value as input;
it is not a valid current action/form/filter/fixture/calculator category.

QR inserts Present only, never infers a category from scan time, and preserves
duplicate handling. New attendance still accepts Active/Inactive non-archived
Members from any home branch under the host Service's scope. It never transfers,
archives or reactivates Members. Manual new/correct operations independently
require attendance.record/attendance.correct. Recorded relationships remain
anchored to the Service/member pair and its host branch.

Reports and inactivity now recognize only Present as physical participation.
Cross-branch Present at a completed Service prevents absence during an eligible
home-branch week. Excused and Absent remain nonphysical; registration boundaries,
home thresholds and human Member Status decisions are unchanged. Status charts
show recorded Present/Excused/Absent, and the aggregate count remains all recorded
rows. No inferred absent population or misleading attendance percentage was added.

## Effective Service lifecycle and time

One lifecycle rule handles reads and actions:

| Persisted state / start | Effective state |
| --- | --- |
| Completed | Completed, regardless of time |
| Cancelled | Cancelled, regardless of time |
| Nonterminal and start at/before now | Ongoing |
| Nonterminal and future start | Scheduled |

`lib/manila-time.ts` centralizes the authoritative start instant from the existing
PostgreSQL DATE plus TIME WITHOUT TIME ZONE, interpreted as Manila UTC+08:00.
`services/lifecycle.ts` applies the effective-state rule. Sorting uses the same
conversion. There is no duplicate start_at, end time, cron, worker, timer or
polling infrastructure. New forms require time; legacy null times use Manila
midnight on their stored date, without rewriting historical data. Explicit
timezone tests cover the instant immediately before and exactly at start, plus
host-timezone independence. New invalid dates/times fail validation.

Creation offers no status selector and rejects supplied manual lifecycle values,
including direct Completed/Cancelled creation. It derives the initial nonterminal
state from the submitted start. A persisted Scheduled label does not prevent a
reached start from behaving as Ongoing, and a future nonterminal start behaves as
Scheduled. No background write is required for correctness.

## Attendance operations and history

The landing queries authorized active host branches and only stored nonterminal
Services, paginating results rather than downloading terminal history. The server
derives effective statuses; the client displays **Ongoing Services** first with
Attendance Open context, then **Upcoming Services** with Preparation Only context.
The compact completed-Service historical mini dashboard remains at the top.
Filters retain their headers/clear behavior even when a section filters to zero.

Ongoing enables the roster and permission-gated manual/QR/correction flows.
Upcoming permits read-only Service information and authorized Edit Service;
its roster, manual form and QR entry are unavailable. Refresh/navigation causes
a reached start to move into Ongoing; no live polling was added.

Every write path checks effective Ongoing on the server. It re-reads the authorized
Service again immediately before the write, including manual conflict recovery.
Scheduled, Completed and Cancelled reject both new attendance and corrections.
The same checks apply regardless of what an older client page showed.

Completed/Cancelled disappear only from the operational Attendance landing.
Services keeps all four effective states. Its permission-gated View Attendance
History link reaches `/portal/services/[serviceId]/attendance`, reusing the same
attendance.view and host-branch checks. Terminal history renders recorded rows
only, without today's unrecorded roster population. Existing direct attendance
detail URLs also remain readable and read-only. Cancelled anomalies preserve
their records and stay excluded from completed-Service analytics.

## Scheduled edits and terminal actions

Normal metadata editing requires services.update, authorized current and proposed
branches, and an effectively Scheduled Service. Ongoing/Completed/Cancelled have
no normal Edit action and reject direct update attempts. Existing active Service
Type validation and history-dependent branch/date locks remain. Existing linked
Contributions are not reattributed by scheduling changes.

At submission, the action reads current date/time/status, verifies branch scope,
performs dependency checks, then evaluates the start again. It matches the prior
branch/date/time/status in the update predicate to reject concurrent metadata
changes. If time has reached start, it returns the inline form error that the
Service has already started or is terminal. Client status is not submitted or
trusted. Framework redirects remain redirects; expected form errors are returned
as data rather than redacted production exceptions.

A Scheduled edit to another future start stays Scheduled; a new at/past start
immediately becomes Ongoing. The time field explicitly explains that effect.
No edit silently makes a terminal state. Explicit Complete/Cancel actions now
live in Services with the existing confirmation modal and services.update/branch
checks. Ongoing may Complete or Cancel; Scheduled may Cancel. Completed and
Cancelled cannot reopen or change terminal state. Completion is never inferred
from elapsed time because no Service end-time model exists.

Concurrency remains the existing application/optimistic-request model, with fresh
checks and guarded metadata writes, rather than a new database locking workflow.
A future audited correction/reopen process for wrong terminal records remains a
separate product decision. Ordinary terminal attendance corrections are closed.

## Fixtures and validation

Fixtures retain 19 Services and 47 attendance rows. Former physical fixture
categories are Present. The future example is always future relative to seed day
(including Sunday); current-day Ongoing examples start at 00:00 Manila. Completed
and Cancelled examples remain available for history QA. Dates remain relative.

- Clean local reset applied baseline and every additive migration successfully.
  Local Auth setup recreated all seven demo accounts. Local verification passed
  47 Attendance, 23 Contributions, 10 Baptisms, unchanged reference rows and all
  70 captured role-permission assignments. Final browser QA rows were removed.
- Full tests with disposable local PostgreSQL suites: **362 passed, zero failed,
  zero skipped**. Tests cover migration/backfill, all three current categories,
  removed-value rejection, QR Present, explicit-versus-unrecorded absence,
  inactivity, Reports, Manila boundaries, automatic creation, ongoing-only writes,
  grouped landing, metadata authorization, terminal actions, elapsed-start race,
  clean form errors, historical branch locks and unchanged Contribution/Baptism
  behavior.
- TypeScript, targeted ESLint, build and git diff --check passed. The build keeps
  Cache Components/Suspense and the existing parent package-lock warning.
- Real Chrome QA used the demo pastor for Service creation/update (the captured
  admin role intentionally lacks those grants) and North-only usher for recording.
  Future creation appeared under Upcoming; manual/QR were closed. Stale Scheduled
  submit produced the inline started error. Rescheduling to the past became
  Ongoing and closed normal editing. The usher recorded inactive Rosa manually
  and South Member Benjie through the QR fallback, both Present, with unchanged
  status/branch/archive/timestamps. Completion removed the Service from Attendance
  and preserved read-only history. Cancelled Services were omitted and QR blocked.
- Ignored screenshots: `supabase/.temp/lifecycle-qr-mobile.png` at 375px and
  `supabase/.temp/lifecycle-history.png` at desktop width. QR was tested through
  its manual-value fallback; physical camera/phone hardware was not used.

## Files changed

- Services lifecycle/actions/form/new/edit/list pages and table; new small
  ServiceLifecycleActions client control and Services attendance-history route.
- Attendance landing/table/detail/scan page, actions, data, types and view.
- Shared Manila conversion; inactivity calculator/participation read, page copy
  and README; Reports copy; module chart categories; AI aggregate terminology.
- Additive attendance lifecycle migration, seed and local verifier; no baseline,
  auth architecture, role assignments, contributor model or Baptism change.
- Attendance/Service, inactivity, Reports/SQL, module summary, navigation and
  filtered-table regressions; test clock injection; demo and module documentation.

The LAN development server is restarted after build validation. Apply the new
additive migration with this application change in any other environment; no
production migration or deployment was performed here.
