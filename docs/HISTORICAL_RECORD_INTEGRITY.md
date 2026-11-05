# Contributions and Baptisms: historical record integrity (Phase 1E)

Current member eligibility controls new relationships. Historical record ownership
controls corrections to an existing fact. A member's present administrative branch
does not prove where the member belonged when a record was created.

## Contributions

Creation requires an active account, `contributions.create`, and an assigned active
branch. A selected member must exist, be non-archived, from any home
branch. The module previously allowed stored-inactive non-archived members; that
rule is retained. Explicit contributor categories now distinguish Member, Visitor and Anonymous; see Phase 2L.

A new optional Service link must belong to the selected branch and must not be
cancelled. Scheduled/ongoing/completed services retain their existing eligibility.
The contribution's own `contribution_date` is independent of `service_date`.

Historical correction requires `contributions.update` and scope for the record's
stored `financial_contributions.church_branch_id`. An unchanged `member_id` is not
checked against today's roster, current branch, status, or archive state. An
unchanged `service_id` is preserved, including a cancelled historical service.

| Field | Normal edit contract |
| --- | --- |
| `church_branch_id` | Immutable; server rejects a change even if both branches are in scope. The form shows a fixed branch. |
| `member_id` | Retain the historical ID, select a currently eligible replacement from any home branch, or explicitly remove the optional link for anonymous attribution. |
| `service_id` | Retain the historical ID, select a currently valid same-branch service, or explicitly remove the optional link. |
| Amount, accounting date, type, payment method, notes | Correctable with existing validation. Service date never replaces accounting date. |
| `recorded_by` | Original recorder retained; the existing legacy-NULL fallback to the authenticated actor remains. |

Adding a different non-null member/service relationship requires an active branch
and the normal creation checks for that relationship. The unchanged other link is
not revalidated. Removing an optional link does not create a new relationship and
is allowed on an authorized historical record, including an inactive branch.

Exact-money code is unchanged: database NUMERIC, normalized decimal-string write
payloads, existing bounded integer-cent arithmetic/formatting, and SQL decimal-text
Reports aggregates. The allowed single-record range remains 0.01–9,999,999,999.99
with at most two decimal places. No floating-point money conversion was added.

## Baptisms

Creation requires an active account, the selected type's permission
(`baptisms.water.create` or `baptisms.holy_ghost.create`), and an assigned active
branch. The member must currently belong to that branch, be non-archived and have
stored status `active`. `baptisms.view` still governs the list separately; existing
create/update routes use their action permissions independently.

The existing one-record-per-`(member_id, baptism_type)` rule remains. Creation checks
for duplicates; the database uniqueness constraint remains the final race guard,
and a unique violation returns the existing readable duplicate message.

Corrections require the stored record type's matching update permission and scope
for `baptism_records.church_branch_id`. Current member transfer, archive or stored
status cannot invalidate that unchanged historical relationship.

| Field | Normal edit contract |
| --- | --- |
| `member_id` | Immutable. Reassigning a sacramental record to a different person is rejected. |
| `baptism_type` | Immutable, including for actors with both update permissions. |
| `church_branch_id` | Immutable historical attribution. |
| `baptism_date` | Correctable valid calendar date or NULL/unknown; blank is never auto-filled. Existing future-date behavior is unchanged. |
| Officiant, location, notes | Correctable with existing length validation. |
| `recorded_by` | Original recorder retained, including the existing legacy-NULL fallback. |

The edit form shows fixed member/type/branch values and submits their original IDs;
server checks enforce immutability regardless of hidden-field tampering. The member
display name is resolved by the recorded ID only after scope and type permission
checks. It does not require access to the member's new branch or reveal that branch.

## Lists, scope and current eligibility

Both lists load the stored records using the record's branch, then resolve linked
identity by ID. They do not derive history from the current eligible member roster.
Search/filter/count behavior is retained. Missing identity data displays an unknown
member/service instead of erasing the recorded fact or implying anonymity.

Historical branch options include inactive assigned branches. An active system
administrator has global historical branch scope; every actor still needs the
operation permission. The shared `lib/historical-records.ts` helpers check that
the historical branch exists and is in scope without requiring it to be active.
New-record forms and new links continue using the existing active-branch helper.
No RLS policies were broadened and no new permissions or role-name gates were added.

Contribution edit options contain minimal non-archived candidates across home branches,
plus its explicitly retained historical member/service. Archived
members remain selectable only as that record's original link; other archived
members are excluded from new/replacement candidates. Their current foreign branch
assignment is not sent as part of the historical fallback option.

Update predicates match the branch and existing member/service/type relationships
read during authorization. A deleted or concurrently reassigned record cannot
silently acknowledge a successful write. Concurrent metadata edits still use the
existing last-write-wins model; no generalized revision/audit subsystem was added.
Creation eligibility checks and the write remain separate requests, as before;
this phase does not add a transaction spanning a concurrent member transfer.

## Reports and other historical records

The existing Reports SQL already scopes Contributions by the financial record's
branch and accounting date, and Baptisms by the baptism record's branch/date.
Neither source joins the current member roster. Its definitions and migration are
unchanged. Dated baptisms enter range metrics; undated baptisms remain a separate
explicit count and do not appear in dated trend totals.
Successful create/correction actions revalidate Reports as well as the module's
list/edit paths, so changes to amounts or record dates refresh reporting views.

Member transfer/archive does not rewrite Contributions, Baptisms, service-based
Attendance, or Follow-up branches. The regression suite executes the real staff
transfer/archive actions and checks all four domains, including historical
Attendance loading. Existing Inactivity calculation and current-branch semantics
remain unchanged. No transfer-effective-date membership history is inferred.

## Remaining correction policy and navigation readiness

- Wrong historical branch: ordinary edits reject it. A deliberate, auditable
  financial/sacramental correction policy is still needed before enabling it.
- Wrong Baptism person or type: normal edit cannot reassign either. A future
  void/supersession or audited correction process must define the remedy. No delete
  flow was added.
- Correcting anonymous/member contribution attribution or removing a Service link
  is explicitly supported, subject to the rules above. No receipts or new financial
  audit ledger was introduced.
- Database-level immutability/column restrictions and transaction/race hardening
  remain separate work; these are server-side application rules. Live RLS and
  deployment behavior were not broadened or verified by this phase.

These routes now distinguish historical corrections from current creation clearly
enough to support a later navigation/flow restructuring. Such restructuring should
preserve independent action permissions, record-branch scope, and immutable identity.
It need not wait for historical membership event tables, but those tables and the
correction policies above remain explicit product decisions. No navigation,
pagination, global visual redesign, or Profile transaction work is included here.

## Files changed in Phase 1E

- `app/portal/contributions/actions.ts`, `data.ts`, `ContributionForm.tsx`,
  `page.tsx`, `[contributionId]/edit/page.tsx`
- `app/portal/baptisms/actions.ts`, `data.ts`, `BaptismForm.tsx`, `page.tsx`,
  `[baptismId]/edit/page.tsx`
- New `lib/historical-records.ts`
- New `tests/contributions-history.test.cjs`, `tests/baptisms-history.test.cjs`,
  `tests/helpers/historical-records-harness.cjs`
- `tests/analytics-postgres.test.cjs`, `tests/fixtures/analytics.sql`: linked Baptism
  fixture and real SQL regression for unchanged branch/date/undated financial and
  sacramental metrics after a transfer/archive/status change
- `AGENTS.md` and this report

The test harness runs actual auth/active-account, permission resolution, branch
scope, actions, loaders and forms, with framework/database transports replaced by
mutable fixtures. A custom role supplies all grants; it is never authorized by a
built-in staff name. PostgreSQL tests use a disposable database when configured.

## Validation results (2026-10-31)

- Full `node --test tests/*.test.cjs` run with both PostgreSQL test ports set to
  the disposable local cluster: **256 passed, zero failed, zero skipped**.
- Includes **43 new application regression tests**, the new Reports SQL
  transfer/archive/status-change regression, and all Phase 1A–1D tests.
- `npm.cmd run build`: passed with Cache Components/Suspense boundaries intact.
- `npx.cmd tsc --noEmit`: passed.
- Targeted ESLint for Contributions, Baptisms, the historical-branch helper,
  new tests/harness and the modified PostgreSQL test: passed.
- `git diff --check`: passed.

PostgreSQL 18 ran in an isolated temporary local cluster on port 56341. Its
disposable databases were dropped by the test suites and the cluster was stopped
after validation. No production data, live schema, or RLS policy was changed.

## Phase 2L extension

Contributor category can be corrected among Member, Visitor and Anonymous with
contributions.update and stored receiving-branch scope. New Member links require
a non-archived Member from any home branch; Visitor requires a trimmed 1-160
character historical name; Anonymous carries neither identity field. Existing
historical Member links remain valid after transfer/archive/status changes.
Branch, recorder, Service integrity and exact NUMERIC rules above remain intact.
Inactivity now counts physical participation anywhere during eligible home weeks.
