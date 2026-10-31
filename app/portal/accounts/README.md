# Account administration authority

Permission determines the operation. Branch/target scope determines its subject.
Every entry first uses the Phase 1A active-account and effective-permission guards.
`target-scope.ts` reads minimal relationship metadata before any account PII is
returned or an account mutation is permitted. It exhausts relationship queries
to prevent API row caps hiding branches during authorization; this is not UI
pagination. No database schema or RLS policy is changed.

## Delegated scope and mixed accounts

- Member account view requires at least one member relationship in an actor
  branch. Only those linked members are returned to delegated managers.
- Staff account view/branch editing requires a staff role (`is_staff`, including
  custom roles) and an explicit assigned branch overlapping the actor's scope.
  A branchless staff account is not globally manageable.
- Both facets use the same target metadata. A mixed account can have visible
  members or staff assignments without authorizing changes to its whole identity.
- Role changes, display-name changes, archive, restore and promotions with role
  grants require every linked-member branch and every staff assignment to be
  within scope. Null/missing linked-member branches fail this full-coverage test;
  staff must have an explicit branch. Inactive staff roles still count when
  protecting relationships. Archived member links also continue to count.
- Any system_admin assignment, even an inactive one, protects the target from
  delegated management. Active system administrators retain global target scope,
  including branchless targets, but still need each operation's permission.

Partial account visibility never grants account-wide mutation authority. Local
branch edits can remove only actor-scope rows, preserve hidden rows even when
omitted from the form, and cannot introduce a new out-of-scope branch. Adds use
upsert before targeted removals. No delete-all/replacement operation is used.
Account-wide controls are disabled for partially covered targets, and hidden
member/branch relationships are not serialized into client props. Scope denials
use the same access-denied destination without revealing target existence.

## Invitations and grantable roles

Invitations require `accounts.invite`. Submitted roles additionally require
`accounts.manage_roles`; submitted branches additionally require
`accounts.manage_branch_access`. Missing capabilities hide the respective form
controls; tampered submissions fail before invitation or writes.

Active staff roles are grantable by metadata, including custom staff roles.
`member` remains owned by member-link semantics, never this staff selector.
Only an active system administrator can grant/remove `system_admin`.
Existing last-admin/self-removal safeguards remain in effect. There is no
ordinary operational role-name allowlist or universal administrator bypass.

The existing complete-staff invariant is preserved for new identities: an active
staff role and at least one active branch are required unless granting system
administrator scope. This route does not issue identity-only, unusable invitations.
Existing in-scope staff can receive role-only or branch-only additions if the
actor has the relevant capability; omitted selections do not grant defaults.
An existing account's display name is preserved during promotion: renaming uses
the separate scoped display-name action. Member linking stays in Members and
continues to require `members.link_account` and validation of each member branch.

## Partial failure and concurrency

Email/shape, permissions, role eligibility, existing-target scope/state, and branch
eligibility are validated before Auth invitation. New-account profile creation,
branch upsert and role upsert remain separate requests after Auth invitation.
Existing grants are additive during promotion. Recovery must never delete an
existing identity or relationships. Failures after an invitation are reported
explicitly; a global administrator may need to recover an unscoped partial account.
Email delivery cannot be rolled back. Concurrent scope/role/profile changes and
last-admin count/write races are not made transactional by these server checks.

## Verified live RLS follow-up

The client reported live self-only member/link/role/branch reads and no ordinary
profile policies. Accounts uses privileged server queries after application
authorization. This pass does not broaden RLS.

The reported legacy user_branch_access policies compare `roles.name` with
`system_admin`. Repository role creation sets name = key, and metadata updates
do not change either; the repository cannot guarantee equality for existing live
rows or external SQL. The application uses active `roles.key` for administrator
identity. A name-only policy without role activity/account-archive predicates
can still authorize inactive/archived administrator sessions directly at the
database boundary. Review the actual policy predicates and align them with key,
role activity and account lifecycle in a separate database-hardening change.
Do not infer that application archive checks revoke direct database privileges.
