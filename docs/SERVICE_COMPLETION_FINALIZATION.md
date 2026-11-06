# Service completion attendance finalization

Implemented November 7, 2026.

## Roster and record rules

The expected roster is the current non-archived Active or Inactive Members whose
home branch equals the Service host branch. This matches the existing normal
Attendance roster and new-record eligibility. No first-attendance date or
historical membership reconstruction is introduced. Member status/home branch
are never changed. Archived Members receive no new rows; their existing records
are preserved.

Existing Present, Excused and Absent records are preserved in full, including
timestamps, methods and recorders. Visiting Members' existing records are also
preserved, but missing foreign-branch Members never receive generated absences.
Attendance at another Service does not exempt a home-roster Member from a
Service-specific Absent record. The separate cross-branch inactivity rule remains
unchanged and continues to recognize physical Present elsewhere.

Generated rows use the existing method=manual value, attendance_status=absent,
check_in_time=NULL and recorded_by=the authenticated completing account. No new
source field or attendance status was added. The method enum remains qr/manual;
it does not distinguish generated absence from staff-entered manual attendance.

## Preview and completion

The Services list was the only completion UI. Its shared ServiceLifecycleActions
component now requests a server-authorized aggregate preview before opening the
existing ConfirmActionModal. The dialog shows Present, Excused, Absent already
recorded and No attendance record. Recorded counts include visiting/historical
attendees; the missing count concerns only the eligible host home roster.
The dialog warns that missing eligible Members will be marked Absent and offers
Cancel and Complete Service. Zero missing gets the explicit all-recorded message.
No roster names or profile details are downloaded for the preview.

The final action reauthorizes services.update and active host-branch access,
rechecks effective lifecycle, and calls the same database function in final mode.
Preview counts are never submitted as authority. Cancellation retains its old
behavior and does not generate attendance. No alternate application completion
path remains: finishService routes completed transitions through finalization.

## Transaction and race behavior

New additive migration:
`supabase/migrations/20261107090000_finalize_service_attendance.sql`.
It adds one service-role-only preview/finalization RPC and two narrow guards;
there are no new tables, columns, permissions or baseline edits.

The RPC locks the Service row, independently validates the supplied authenticated
actor against active account/roles/services.update and active host-branch scope,
and checks the current Manila start instant. Stored Scheduled is accepted only
when effectively Ongoing. Future, Completed and Cancelled Services are rejected.
Current eligible home Members are share-locked against concurrent archive/transfer.
Missing records are recalculated and inserted in one set-based INSERT with
ON CONFLICT(service_id,member_id) DO NOTHING. The Service update then occurs in
the same transaction; any failure rolls back both operations.

Application-role Attendance inserts/updates take the same Service row lock and
recheck effective Ongoing status. New records also recheck current eligibility.
A QR/manual write that wins the lock first is preserved by completion. A write
queued behind completion is rejected after it observes Completed. Concurrent
completion requests serialize, and the second cannot finalize twice. Direct
application-role updates to Completed are rejected unless made within the RPC's
transaction-local completion guard. Database-owner historical seed/import work
remains supported; it is a trusted maintenance path, not an application endpoint.

RPC execution is revoked from PUBLIC, anon and authenticated. The server obtains
the actor ID from its permission context, not client input. Database guards do not
grant recording or correction permission; existing application checks/RLS remain.

## Downstream behavior and correction policy

Generated Absent rows are ordinary stored attendance. Existing dashboard totals,
selected-date donut/stacked charts therefore include them
without a separate analytics path. Present-only averages/Reports physical counts
still exclude Absent. The Latest Service Attendance card and its comparison now
count Present only, so generated Absent does not increase that KPI. Service, Attendance, Reports and inactivity paths are
revalidated after completion.

The current lifecycle allows corrections only while Ongoing. Completed and
Cancelled attendance were already read-only; this task preserves that policy.
Generated Absent is not given a separate immutable flag, but there is currently no
authorized post-completion correction flow for any attendance. Browser scenario F
was verified as read-only rather than inventing a new correction permission/rule.
Enabling post-completion correction is the remaining separate product decision.

## Demo and local application

The seed adds the isolated South Service named Service Completion Attendance
Finalization (`e3000000-0000-4000-8000-000000000001`), dated yesterday and Ongoing.
It starts with six home Present, one home Excused, one home Absent, and a North
visiting Present. Missing home Active/Inactive Members are resolved from the real
roster at preview/submit; archived home Members are excluded. Reseeding resets only
this fixture's attendance within its own block. Clean-seed verification expectations
are updated to 20 Services, 56 Attendance records, 15 public functions and five
triggers (including the Auth trigger).

The migration was applied with Supabase migration up --local. Only the dedicated
new demo block was applied to the existing local database, preserving other local
data and Auth accounts. No clean reset or Auth setup was necessary. Hosted data,
environment configuration and the baseline were untouched. LAN development was
restarted after the production build.

## Changed files

- supabase/migrations/20261107090000_finalize_service_attendance.sql: atomic RPC and race/bypass guards.
- supabase/seed.sql: isolated completion demo.
- app/portal/services/actions.ts: authorized preview and centralized completion RPC.
- app/portal/services/ServiceLifecycleActions.tsx: preview, warning and aggregate summary.
- components/ui/confirm-action-modal.tsx: optional summary content and dialog accessibility attributes.
- scripts/verify-local-db.mjs: updated clean-seed/schema counts.
- tests/service-completion-postgres.test.cjs: real disposable-PostgreSQL transaction, concurrency and downstream tests.
- tests/services-attendance.test.cjs: completion action, preview and authorization regressions.
- tests/table-filter-ux.test.cjs: correct four-column expectations for the earlier compact Services/Attendance table changes.

## Verification

Full suite with all optional PostgreSQL ports configured: **394 passed, zero
failures, zero skipped**. Real database tests cover recorded-status preservation,
host roster, inactive inclusion, archived/foreign exclusion, stale preview,
concurrent completion, QR before/after completion, partial-failure rollback,
permissions/lifecycle, zero missing, actual Reports/module aggregates and physical
cross-branch inactivity protection. TypeScript, targeted ESLint, production build
and git diff --check passed.

Local Chrome verified completion preview/counts, explicit warning, completion with
missing attendance, a newly scanned Present after preview, zero-missing completion,
visiting preservation, foreign/archived exclusion and the unchanged historical
read-only screen. Desktop/mobile dialog screenshots were inspected and the mobile
dialog had no horizontal overflow. Temporary QA Services/Attendance were removed;
the dedicated demo remains available for review.
