# Attendance operations and history

Attendance statuses are Present, Excused and explicitly recorded Absent.
Only Present is physical participation. A roster Member with no attendance row
is **No record (current roster)**, not a fabricated Absent record. The status
filter and summary distinguish these populations.

## Effective Service lifecycle

One helper in services/lifecycle.ts combines DATE and TIME WITHOUT TIME ZONE as
Asia/Manila (+08:00). Completed/Cancelled are authoritative terminal states.
Otherwise a start at/before the current instant is Ongoing; a future start is
Scheduled, regardless of the stored nonterminal label. New schedules require a
start time. Legacy null times are interpreted as Manila midnight on that date.
No start_at column, cron or polling was introduced.

The Attendance landing queries only stored nonterminal Services in authorized
active host branches, paginates them, derives effective status on the server and
shows Ongoing Services before Upcoming Services. The compact historical summary
remains above these sections. Upcoming permits read-only Service information and
services.update-authorized scheduling edits, without opening the roster or QR.
A normal refresh/navigation reflects a reached start time.

Every manual/QR/correction action rechecks the effective host-Service state and
operation permission before writing. Only Ongoing accepts writes. Scheduled,
Completed and Cancelled are read-only, including corrections. QR always inserts
Present; duplicates retain the existing record. Manual conflict recovery still
requires attendance.correct and a fresh authorized Ongoing Service. Attendance
unique(service_id,member_id), record identities and historical branch ownership
remain unchanged.

## Member eligibility and history

New attendance accepts non-archived Active or Inactive Members from any home
branch. Host-Service access and attendance.record authorize recording; home-branch
access is unnecessary. The focused church-wide identity lookup returns minimal
name/ID/home/status fields, never contact/account/profile data. Visiting Member
and Inactive Member labels are derived identity context. No Member status,
branch or archive field is written by attendance. Existing recorded relationships
remain correctable during Ongoing even after a transfer/archive/status change.

Completed/Cancelled attendance remains accessible through Services' View
Attendance History action at /portal/services/[serviceId]/attendance, with
attendance.view and host-branch scope. It shows recorded rows, not a reconstructed
historical absence roster. Direct old Attendance detail links also retain read-only
history. Terminal corrections now require a separate future audited product
workflow; ordinary Attendance cannot reopen or modify terminal Services.

## Reports and monitoring

The additive migration converts old physical-status rows to Present and tightens
the CHECK to Present/Excused/Absent. Reports and module SQL aggregate Present only
for physical check-ins. Status charts use recorded Present/Excused/Absent, never
arbitrary roster subtraction. Inactivity uses completed home-branch eligible weeks
and registration time; Present at any completed branch Service counts for that
week. Excused and Absent do not reset absence streaks. Member Status remains a
human decision. No transfer-effective-date roster is invented.

Timestamp inputs remain Manila wall time converted to UTC TIMESTAMPTZ. Blank
check-in defaults to now only for Present; Excused/Absent default null. Unchanged
corrections retain subsecond precision. No scheduling edit rewrites attendance
history. See docs/ATTENDANCE_SERVICE_LIFECYCLE.md for the full change report.
