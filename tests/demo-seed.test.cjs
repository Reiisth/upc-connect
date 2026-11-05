/* eslint-disable @typescript-eslint/no-require-imports -- The repository's Node tests use CommonJS. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const seed = fs.readFileSync(path.join(root, "supabase/seed.sql"), "utf8");

function section(start, end) {
  const startAt = seed.indexOf(start);
  const endAt = seed.indexOf(end, startAt + start.length);
  assert.notEqual(startAt, -1, `missing section: ${start}`);
  assert.notEqual(endAt, -1, `missing end marker: ${end}`);
  return seed.slice(startAt, endAt);
}

function ids(block, prefix) {
  return [...block.matchAll(new RegExp(`'(${prefix}[0-9a-f-]{35})'`, "g"))]
    .map((match) => match[1]);
}

test("demo seed has stable, expected-sized records and no Auth or grant bootstrap", () => {
  const members = section("INSERT INTO public.members", "-- Five completed Sundays");
  const memberIds = ids(members, "a");
  assert.equal(memberIds.length, 30);
  assert.equal(new Set(memberIds).size, 30);

  const departments = section("INSERT INTO public.departments", "-- This inactive reference row");
  const departmentIds = ids(departments, "d");
  assert.equal(departmentIds.length, 8);
  assert.equal(new Set(departmentIds).size, 8);

  const branchRows = section("INSERT INTO public.church_branches", "INSERT INTO public.departments");
  assert.equal(ids(branchRows, "b").length, 2);
  assert.match(branchRows, /'b0000000-0000-4000-8000-000000000001'[^\n]*,true,3,now\(\)/);
  assert.match(branchRows, /'b0000000-0000-4000-8000-000000000002'[^\n]*,true,4,now\(\)/);

  const attendance = section("WITH patterns(member_id,branch_id,pattern)", "-- Ten follow-ups");
  const patterns = [...attendance.matchAll(/,'([01]{5})'\)/g)].map((match) => match[1]);
  assert.equal(patterns.length, 28);
  assert.equal(patterns.reduce((total, pattern) => total + [...pattern].filter((x) => x === "1").length, 0), 44);
  assert.match(attendance, /000000000004'::uuid[^\n]*'00011'/);
  assert.match(attendance, /000000000010'::uuid[^\n]*'10000'/);

  const followups = section("WITH followups(", "-- Twenty branch-consistent examples");
  assert.equal(ids(followups, "c").length, 10);
  const contributions = section("WITH contributions(", "-- Ten records cover both types");
  assert.equal(ids(contributions, "c").length, 20);
  const baptisms = section("INSERT INTO public.baptism_records", "-- Phase 2L:");
  assert.equal(ids(baptisms, "c").length, 10);

  assert.match(seed, /Named non-member Visitor/);
  assert.match(seed, /North Member gives at South/);
  assert.match(seed, /South Member gives at North/);
  assert.match(seed, /generate_series\(1,5\)/);
  assert.match(seed, /'demo_legacy_gathering','UPC Demo Legacy Gathering',false/);
  assert.doesNotMatch(seed, /auth\.users|INSERT\s+INTO\s+public\.user_roles|INSERT\s+INTO\s+public\.role_permissions/i);
  assert.doesNotMatch(seed, /gen_random_uuid\s*\(/i);
});
