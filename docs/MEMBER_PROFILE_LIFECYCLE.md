# Member and Profile lifecycle (Phase 1D)

Staff manage the church record through `/portal/members/[memberId]` and
`/portal/members/[memberId]/edit`. `/portal/profile` remains linked-account
self-service. Active-account and active-role permission checks apply to both.

## Field ownership

| Classification | Fields | Writer |
| --- | --- | --- |
| Church managed | `church_branch_id`, `first_attendance_date`, `member_status`, `department_id`, `position`, `zone` | `members.update` and target branch scope |
| Member archive | `is_archived`, `archived_at` | `members.archive` and target branch scope; restore uses the same permission |
| Registration identity, intentionally shared | `first_name`, `middle_name`, `last_name` | Staff registration/edit and the linked account's Profile |
| Personal self-service | `nickname`, `birth_date`, `gender`, `civil_status`, `phone_number`, `street_address`, `barangay`, `city`, `province`, `country`, existing `wedding_anniversary` | `profile.update` and `account_members` ownership |
| Supplemental personal profile | Non-reserved custom field definitions and their JSON values | The linked account's Profile; Profile Fields controls presentation/validation |
| System maintained | `id`, `created_at`, `updated_at`, `account_status`, invitation/acceptance metadata, `profile_status`, `profile_completed_at`, account relationships | Existing lifecycle actions; Profile sets completion metadata after successful validation/persistence |
| Account controlled / read only in Profile | Account Email from authenticated Auth user | `auth.users.email` via `account_members`; no Member email column or Profile email mutation |
| Legacy / outside this editor | `department` (text), `photo_url` | Preserved; staff uses `department_id`. No new photo workflow. |
| Separate operational records | Baptisms, attendance, follow-ups, contributions | Their existing modules and permissions |

Staff edit intentionally permits registration-name correction, including members
without accounts. It does not expose the other personal/contact fields. Profile
may also maintain those three names. The exact application allowlists live in
`lib/member-field-policy.ts` and `app/portal/members/validation.ts`.

Profile Fields displays only personal and supplemental definitions. Existing
operational definitions remain stored for compatibility but cannot grant Profile
write authority, become required completion fields, or be changed/reset through
this configuration screen. Built-in input types cannot be changed. New custom
keys cannot impersonate personal, operational, linkage, or system columns. Custom
branch/department selections are supplemental JSON values, never assignments.

## Staff workflow and permissions

- List/detail: `members.view` and current target branch visibility. The existing
  list search, filters, archive handling and pagination are retained.
- Create: `members.create` and selected active branch authorization. Capture
  first/middle/last name, branch, optional first attendance date and administrative
  status. No account is automatically created or invited.
- After creation: open detail when `members.view` is available, otherwise edit
  when `members.update` is available. A create-only actor gets a contextual success
  notice on registration instead of an unauthorized destination.
- Edit: `members.update`, current target scope, and authorization for both old
  and new active branches. Custom roles work through permissions. System admins
  have global branch scope but still require the action permission. A system
  admin may repair a previously unassigned member by choosing an active branch.
- Edit/archive writes match the branch read during authorization; edits also
  match an unarchived record. A concurrent transfer/archive cannot silently turn
  the checked target into an out-of-scope update.
- Connect/Invite: `members.link_account` and selected member branch scope. The
  detail link reuses `inviteMembers`; no second provisioning implementation.
  Existing-account lookup and email suggestions use Phase 1B account target
  scope. Protected/out-of-scope existing accounts cannot be selected. Linking
  does not grant staff roles or branch assignments. The optional contextual
  return opens the selected member's detail only with `members.view`.
- Detail links to the existing Attendance workspace, Inactivity and member
  Follow-up History when their permissions allow. It does not copy those modules.

The existing active-branch rule also applies to archive/restore. An inactive
branch must be reactivated through its existing authorized workflow before
these mutations; global scope does not make an inactive branch active.

## Eligibility, status and history

`first_attendance_date` accepts a real ISO calendar date no later than today in
Asia/Manila. Staff can set, add, correct, or clear it. Blank means SQL NULL and
explicitly unknown eligibility. `created_at` is never substituted. Member writes
revalidate Inactivity and other relevant views; the calculator itself is unchanged.

The supplied live schema has two `member_status` CHECK constraints. Their
intersection permits only `active` and `inactive`, so these are the offered
administrative values. They do not represent derived weekly inactivity. Archive
uses the separate boolean/timestamp, not a status string. Existing NULL statuses
remain readable; a staff save chooses an explicit administrative value.

Attendance monitoring uses separate flags (`Monitoring`, `Needs Follow-up`,
`Unknown`). Reaching the absence follow-up threshold never updates Member Status.
A status decision remains a human action in the existing permission- and
branch-checked staff member edit workflow; follow-up outcomes do not change it.

Current branch means present administrative assignment. No transfer date,
effective interval, or past membership is inferred. Attendance retains its
service-based historical branch context. Member edits/archive do not change
attendance rows, services, or `member_follow_ups.church_branch_id`. Inactivity
continues its documented current-branch model, so a transfer changes the current
branch used by the calculation without manufacturing historical membership.

Member archive preserves history and account links. Existing operational
selectors continue excluding archived members. An archived member's linked owner
may view the record but cannot complete/edit it until staff restore it. Member
archive never archives `profiles` or Supabase Auth; account archive remains a
separate permission-governed lifecycle. Restore does not invent eligibility or
alter administrative status.

## Canonical Profile persistence and validation

Both initial completion and later editing bind `saveMemberProfile` in
`app/portal/profile/actions.ts`. It checks `profile.update`, linked ownership,
and an unarchived member on every request. Staff permission grants no Profile
ownership. Profile reads separately require `profile.view` and ownership.

All submitted data is validated before mutation: allowlisted personal keys,
known visible custom IDs, duplicate/non-text entries, configured required fields,
types, select choices, calendar dates, phone normalization, finite numbers,
email syntax and lengths. Strings trim; optional blanks become NULL; unchecked
optional custom checkboxes become false. Registration names remain required.
Phone values normalize to international form. Gender/civil-status choices
normalize to their stored lower-case values. Hidden personal fields and omitted
personal values are preserved; hidden supplemental values are not overwritten.

Limits are 120 characters for names, 40 for phone input, 250 for other personal
text, 500 for ordinary supplemental input, and 2,000 for supplemental textarea.
Birth date and existing anniversary cannot be future dates; custom dates may
be future dates. Anniversary is cleared when a submitted civil status no longer
supports it. Province, City / Municipality and Barangay are text fields validated
locally, with requiredness controlled by Profile Fields. No address API is used.
Region is no longer collected or stored; there is no NCR-specific Region rule.

Validation and rendering order are separate concerns. Configured sort order and
labels remain presentation; they cannot expand the server's write allowlist.

## Partial writes and remaining decisions before Phase 1E

Profile persistence still uses two PostgREST requests. After validating the whole
payload, it upserts supplemental values first, then writes personal fields and
completion metadata. Custom-write failure leaves the base profile unchanged.
If the later base update fails (including an intervening archive), supplemental
values may already have saved. The action reports that case and permits retry;
completion is not newly marked successful. This is an improvement over marking
the base complete before a failing supplemental write, not full atomicity.

No database migration is included in Phase 1D. The application enforces this
ownership boundary; existing linked-member RLS is not a column-level allowlist.
Before treating raw authenticated Supabase writes as enforcing the same boundary,
audit live member/custom-value policies and implement database enforcement (and,
if desired, one transactional Profile RPC). This phase's tests use real actions
and guards with database/Auth transports stubbed, not a live RLS integration.

Other deferred decisions: reconcile the duplicate status constraints, backfill
unknown first attendance only from verified records, choose a transfer-effective
history model, and decide whether staff need additional personal-field authority.
The existing multi-member invitation RPC/Auth sequence is also not one transaction;
this phase reuses it rather than redesigning provisioning. Contributions/Baptisms
historical corrections, navigation and new Wedding/Child Dedication modules remain
outside this phase.

## Changed files and validation

New files:

- `app/portal/members/[memberId]/page.tsx`
- `app/portal/members/[memberId]/edit/page.tsx`
- `app/portal/members/MemberChurchForm.tsx`
- `app/portal/members/MemberArchiveControl.tsx`
- `app/portal/members/data.ts`
- `app/portal/members/validation.ts`
- `app/portal/profile/actions.ts`
- `lib/member-field-policy.ts`
- `lib/member-validation.ts`
- `tests/member-profile.test.cjs`
- `docs/MEMBER_PROFILE_LIFECYCLE.md`

Updated files:

- `AGENTS.md`
- `app/portal/components/MemberProfileForm.tsx`
- `app/portal/administration/profile-fields/FieldManagementTable.tsx`
- `app/portal/administration/profile-fields/actions.ts`
- `app/portal/administration/profile-fields/page.tsx`

- `app/portal/members/MembersTable.tsx`
- `app/portal/members/actions.ts`
- `app/portal/members/invite/page.tsx`
- `app/portal/members/new/page.tsx`
- `app/portal/profile/[memberId]/page.tsx`
- `app/portal/profile/[memberId]/edit/page.tsx`
- `tests/helpers/load-typescript.cjs` (share Error across VM-loaded modules so
  validation catches behave like production; document existing harness lint rules)

Validated locally on 2026-10-31:

- `node --test tests/*.test.cjs`: 181 passed, zero failed, two optional database
  integration tests skipped (Analytics and branch authorization; no disposable
  PostgreSQL connection configured). Includes 20 new Member/Profile tests.
- `npm.cmd run build`: passed, including the new staff routes and Suspense rules.
- `npx.cmd tsc --noEmit`: passed.
- Targeted ESLint for changed application files and the regression harness/tests:
  passed.
- `git diff --check`: passed.

No live database changes or Auth invitations were performed. Live schema evidence
came from the supplied read-only metadata query; provider connectivity and live
database RLS were not integration-tested in this phase.

## Administration catalog updates (Phase 2H)

- Profile Fields is canonical at `/portal/administration/profile-fields`; the
  old `/portal/field-management` URL redirects there. Its existing
  `administration.view` authorization, including mutation actions, is retained.
- `dashboard.view` had no active enforcement point after Dashboard removal. It
  is removed from the application permission catalog and role assignments by
  an additive migration. Reports continues to require only `reports.view`.
- Departments reuse the existing global `departments` reference table because
  Member and Profile records have no branch-specific department relation.
  Staff controls the `department_id` Member assignment; Profile self-service
  cannot change it. Deactivation preserves existing Member references and
  removes the department from new assignments; edit forms retain a selected
  inactive department until staff chooses an active replacement.
