# Member address cleanup

Region was stored both as `members.region` and a configurable built-in Profile
Field. Active callers were MemberProfileForm (type, state, lookup, requiredness,
NCR province exception, label and supplemental option source), profile save
(server PSA catalog validation), member-field policy/validation, Profile Fields
initialization/editor, the demo seed, and lifecycle documentation/tests.

Staff member creation/edit intentionally handles registration/church information;
personal address editing remains linked-account self-service. Member detail
already joins street, barangay, city, province and country with empty parts
filtered out. Member list/search/filter/export, account linking, Reports and
Gemini have no Region-specific consumer. No changes to those workflows are needed.

Province, City / Municipality and Barangay were already text inputs, with no
callers of the province/city/barangay PSA routes. Removing the sole Region lookup
allows deleting all five unused PSA routes and the runtime PSA_API_KEY dependency.
No replacement API or dependency is introduced. Existing country, street and
independent church Zone fields are preserved. Requiredness of retained address
fields still follows Profile Fields; it no longer depends on a Region/NCR lookup.

Migration `20261107110000_remove_member_region.sql` discards Region column data,
removes its field definition and supplemental values, and retires any removed
PSA option source on other supplemental definitions. It never copies geography
or changes province/city/barangay. Region remains a reserved unsupported key to
reject forged submissions and prevent recreation as a custom personal field.

The baseline, archived migrations, capture files and captured reference bootstrap
remain unchanged. Because local reset loads that historical bootstrap after
migrations, the current demo seed explicitly deletes its retired Region definition
before creating fixtures. The seed omits Region from all 30 members and preserves
their other address values. Local verification compares the historical reference
snapshot with the intentional field removal, while checking the column and
configuration are absent. Historical source files therefore still mention Region;
the current database and user flows do not retain it.

Environment audit: PSA_API_KEY was present only in ignored .env.local and was
removed there. No address API variable exists in .env.example or
.env.supabase.local. No credentials are recorded here. GEMINI_API_KEY remains
independent. PSA_API_KEY is no longer required.

Validation (local, 2026-11-07): local reset and seven-account Auth setup passed;
407/407 tests passed with no skips, including real PostgreSQL suites; production
build, standalone TypeScript, targeted ESLint and git diff checks passed. Database
verification confirms all 30 demo addresses retain province/city/barangay and no
Region column/configuration remains. Browser QA passed staff create/edit, owned
profile address save, member detail formatting and Profile Fields configuration;
no PSA requests were made. Temporary QA records were deleted and the edited demo
profile restored. Development navigation emitted the existing /portal Suspense
warning; the production build passed. The migration was applied locally only.
