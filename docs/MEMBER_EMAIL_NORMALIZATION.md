# Account email is authoritative

## Audit and decision (November 8, 2026)

The previous schema offered competing values in `members.email` and
`auth.users.email`. There is no `accounts` table and `profiles` contains only
`id`, `display_name`, `created_at`, and `archived_at`; it does not mirror email.
`account_members` links a Member to the Auth user through its profile ID, with
the existing one-account-per-member constraint. One account may own multiple
Member profiles.

No independent Member contact-email requirement was found. Self-service already
rendered the field read-only with “Email is managed through the connected
account”; validation prevented editing it. Invitations explicitly ask for an
account email. Staff registration/edit already accepted only identity and church
fields, without requiring email or creating Auth accounts. Therefore the chosen
model removes the Member column, rather than renaming it to `contact_email` or
adding a synchronization trigger.

Hosted pre-migration audit of all 180 members:

| Classification | Count |
| --- | ---: |
| A: Member email matches linked Auth email | 0 |
| B: Member email NULL, linked Auth has email | 1 |
| C: Member email differs from linked Auth email | 0 |
| D: Member email present with no linked account | 0 |
| Unlinked member with no email | 179 |

All Member email values were NULL. No hosted contact data needs conversion and
no new Auth accounts are created to preserve a legacy value. This audit applies
to the owner's confirmed demo-only environment, not to an eventual production
database with different data. Audit and back up again before applying elsewhere.

## Every active use found and its disposition

| Previous use | Final behavior |
| --- | --- |
| Members query, `Member` DTO, email column and email search | Removed. Members search remains name-based; Accounts retains canonical email search. No Auth-directory lookup is added to the Member list. |
| Member Detail Account email and Personal Information email | Single Account Email under Account, resolved server-side through `account_members` and the existing Accounts Auth loader; “No linked account” when absent. No fallback to Member data. |
| Profile form `member.email ?? accountEmail` and Member form DTO | Removed Member field; explicit disabled/read-only Account Email uses the authenticated Auth user's current email. |
| Member Card/print back email | Separate optional `accountEmail` prop supplied by the owned Profile page. Staff list modals omit email rather than bulk-loading Auth data. QR payload remains the Member UUID. |
| Profile field policy, required-field checks, default Email field definition | Email is not a configurable Member built-in. The reserved key remains blocked against reintroduction; forged Profile email submissions are rejected. |
| Invitation action | Still takes an explicit account email and creates/connects the Auth account through the existing authorized workflow; no duplicate Member update. |
| Disconnect action | Preserves lifecycle cleanup without writing an email column. |
| `handle_profile_delete()` | Existing trigger function still resets linked Member account status; obsolete email clearing removed. Function identity, ownership and ACL remain unchanged. |
| Local SQL demo seed | Removed member email column/values/upsert synchronization. |
| Local Auth setup | Auth emails remain required; linked Member setup only updates account lifecycle metadata. |
| Hosted generator/seed and rename/scrub/verification tools | Already generated no Member email values; Auth account emails remain unchanged. Current Members are migrated in place, not scrubbed/reseeded. |
| Generated schema types and Member UI types | Generated Member Row/Insert/Update have no email; Member card/form/list DTO fields removed. |
| Positive test fixtures | Removed duplicate Member email fields. Deliberate unknown/private email injection tests remain to verify privacy and rejection. |
| Reports, Gemini, attendance, contributions, baptisms, follow-ups | No active Member email dependency found. Reports use aggregates; Gemini's explicit aggregate allowlist excludes Member and Account emails. Operational relationships and logic are untouched. |
| Exports | No separate Member data export found. The existing printable Member Card is covered above. |

Historical dumps, archived SQL and already-applied migrations retain their original
definitions. They are evidence, not active runtime readers. Generic custom-field
type `email` validation remains supported for separately defined supplemental
fields; it does not recreate a Member/account email column. No such independent
contact-email requirement was identified in this audit.

## Authorization and current values

`loadMemberAccountEmail()` is server-only and called only after
`requireStaffMember(..., 'members.view')` verifies permission and Member branch
scope. It reads the existing `member` relationship, reuses `getAuthUsersByIds()`,
and returns only the linked user ID and canonical email. It never sends Auth
objects/directory data or privileged credentials to a client. Auth failures fail
closed rather than presenting a stale or fabricated email. The loader is not
persistently cached, so Auth email changes appear on subsequent renders.

Owned Profile views retain `profile.view`/`profile.update` and linked ownership
checks, using the authenticated user's current Auth email. Member management
does not mutate Auth email. Account-management permissions, target scope,
invitations, role grants and branch assignments remain unchanged. Showing the
single email on a scoped Member detail does not grant account-management actions.

## Migration and release

New migration: `20261108090000_remove_member_email.sql`, after the existing eight
migrations. It updates the existing profile-deletion function, removes obsolete
Email field metadata/its supplemental values, drops `members.email` without
CASCADE, and notifies PostgREST to reload its schema. The baseline and all old
migration files are unchanged. No Auth users, links, Member IDs, operational rows,
RLS policies, permissions, branches or QR identifiers are changed.

Release order avoids breaking the existing deployed frontend:

1. Apply locally with `npx.cmd --yes supabase@3.0.0 migration up --local` (no reset).
2. Run `npm.cmd run db:local:types`. No prior generated-type workflow/file existed;
   this fixed-local command invokes the pinned CLI and writes its unedited output
   to `lib/database.types.ts`. Do not hand-edit the generated file.
3. Run full tests, TypeScript, targeted ESLint, build and `git diff --check`.
4. `npx.cmd --yes supabase@3.0.0 migration list --remote=uuionqwconjeguxcwnla`.
5. `npx.cmd --yes supabase@3.0.0 db push --remote=uuionqwconjeguxcwnla --dry-run --skip-vault`.
   Confirm only this migration is pending; exclude seed/role/Vault operations.
6. Commit/push the matching app to `master` for the user-confirmed Vercel workflow
   at `https://upc-connect.vercel.app/`. The new app can run before the column is
   removed because it no longer reads/writes that column.
7. Confirm that deployment is healthy. Take private schema/data/Auth backups and
   before-data fingerprints, then apply only the intended migration using the
   same explicit target and `--skip-vault --yes`, without a reset.
8. Verify removed column/metadata, trigger cleanup, canonical linked/unlinked UI,
   unchanged Auth identities/credentials/relationships and operational fingerprints.
   Record the approved new schema preservation baseline for current demo checks.

The hosted migration must wait if the matching Vercel deployment cannot be
verified. Do not drop the column under a frontend that still queries it.

## Regression coverage and changed files

Tests cover account-free Member creation; rejecting Member/Profile email writes;
fresh linked Auth email including a changed email; no unlinked fallback; list,
seed and generated-type source checks; and actual PostgreSQL migration/removal,
retained account links and profile deletion after the email column is gone.
Existing authorization, invitations, account linking, QR, Reports and Gemini
privacy tests remain in the full suite.

Changes span the Members list/detail/actions and new `account-email.ts`, Profile
form/card wiring and action validation, member-field policy/defaults, local seed
and Auth setup, generated types/local type-generation command, the new migration,
Member/SQL regression tests, and this document plus Member lifecycle documentation.
No duplicate Account email source remains in the intended final schema.

Local release checks passed: **424 tests, zero failures/skips**, including the
disposable PostgreSQL migration test; final production build, TypeScript,
targeted ESLint, regenerated schema types and diff checks passed. The updated
local SQL seed also ran successfully against the migrated schema. Hosted history
and dry run confirmed exactly this one pending migration, with no seeds/roles.
Hosted application/migration verification is recorded after the release below.

## Hosted release completed

The user confirmed Vercel deploys `Reiisth/upc-connect` from `master` and explicitly
authorized committing/pushing this change. Application commit `851b5fe` and the
generated-whitespace normalization `54fbdd6` were pushed; Vercel reported success
for `54fbdd6`. Production browser checks passed **before** the hosted column drop,
then passed again **after** the migration at `https://upc-connect.vercel.app/`:

- Member list contains no Email column.
- The linked Member shows `demo.member@example.com` from Auth despite its former
  Member email being NULL.
- An unlinked Member shows “No linked account”.
- The original demo Member credentials still sign in, and the owned Profile form
  shows a disabled/read-only canonical Account Email.

Hosted migration `20261108090000` is applied exactly once; Member email column
count and obsolete Email field-definition count are both zero. Field definitions
decreased intentionally from 21 to 20. Current counts remain 180 members,
182 services, 11,588 attendance records, 700 contributions, 80 baptisms,
90 follow-ups, 7 profiles/Auth accounts, 1 account-member link, 7 user-role links,
9 branch-access links, 69 role-permission assignments and 1 saved AI document.

Pre/post fingerprints matched for all Member data excluding the deliberately
removed column, all other operational rows, remaining field definitions, links,
roles/permissions, branches, RLS policies, all other functions, Auth rows during
the migration, and all previous migration-history rows. Before deployment,
Auth user IDs/emails/password hashes and identity links were also compared with
the private backup; normal verification sign-ins can update Auth activity
timestamps. The local demo credential file hash remained unchanged.

Private schema/public/Auth backup:
`supabase/.temp/hosted-demo/2026-11-08T03-38-14-676Z-33068/`.
Private deployment/preservation receipt:
`supabase/.temp/hosted-demo/2026-11-08T03-43-20-108Z-38400/`.
The ignored latest-seed receipt records this approved schema update and retains
the previous preservation baseline in its history; it does not pretend the
original seed schema was unchanged. All backups and credentials remain ignored.

No competing Member/account email source remains in the deployed application or
hosted schema. Historical baseline/dumps intentionally still mention the removed
column and must not be edited or replayed over the current schema.
