# Portal account authorization

An application account is usable when Supabase authenticates it and its existing
`profiles` row has `archived_at IS NULL`. Missing profiles, lookup errors, and
archived profiles fail closed. `requireActiveAccount()` redirects unauthenticated
requests to `/login` and authenticated unusable accounts to `/access-denied`.
`getActiveAccount()` and authentication reads use React request-scoped cache;
there is no persistent account-state cache.

`getCurrentUserPermissions()` returns no permissions for unusable accounts.
`requirePermission()` first requires an active account, then resolves only active
assigned roles and active catalog permissions. Custom roles use the same path.
Neither system administrators nor preserved Auth sessions bypass account state.
Restoring `profiles.archived_at` to null restores the preserved active grants.
The portal shell and entry resolver also enforce active-account state.

Profile view requires `profile.view`; edit and both completion/update actions
require `profile.update`. Detail/edit/actions additionally verify the current
account's `relationship = member` ownership before loading or writing the member.
View-only users see the member card rather than an editable completion form.
My Account requires an active authenticated account, with no role requirement.
Password changes are server actions preserving current-password reauthentication.

Invitation confirmation and password setup check account state server-side.
Setup resolves effective permissions and linked profiles on the server: any
non-profile capability proceeds to `/portal`, profile-view-only access with a
linked member proceeds to `/portal/profile`, and no usable grant proceeds to
`/access-denied`. The existing portal resolver still chooses concrete workspaces;
mutation-only grants without a landing workspace are not redesigned in Phase 1A.
Password setup never authorizes from client-supplied role or capability arrays.

Archive does not delete or rewrite Auth users, roles, member links, branch
assignments, or historical records. It blocks on the next server request even
with an existing session or an already-open password/profile form. Sessions are
not forcibly signed out, allowing restore without reconstructing relationships.
An already-rendered page can remain visible until its next server interaction.
Checks do not make archive and a simultaneous in-flight write transactional.

This application boundary does not alter deployed Supabase RLS or prevent direct
Auth-provider password operations. Live RLS is outside this repository's complete
schema history; verify direct database access separately before claiming database-
wide archive revocation. Phase 1A changes normal portal pages/actions only.

Branch-scope special cases, last-admin safeguards, and system-role protections
are unchanged. Phase 1B account target scope and grantable-role rules are documented
in `app/portal/accounts/README.md`. Navigation and operational-module changes
remain for later phases.
