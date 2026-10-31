/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner uses CommonJS. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('branch deactivation uses the shared confirmation and the branch list has one Add Branch action', () => {
  const branchPage = fs.readFileSync('app/portal/administration/branches/page.tsx', 'utf8');
  const branchAction = fs.readFileSync('app/portal/administration/branches/BranchLifecycleAction.tsx', 'utf8');
  assert.match(branchPage, /<BranchLifecycleAction/);
  assert.doesNotMatch(branchPage, /TableActionSubmit|setBranchActive\.bind/);
  assert.equal((branchPage.match(/Add Branch/g) ?? []).length, 1);
  assert.match(branchAction, /@\/components\/ui\/confirm-action-modal/);
  assert.match(branchAction, /This branch will no longer be available for new operations/);
  assert.match(branchAction, /Existing records and branch assignments will be preserved/);
});

test('member and field-management flows use the shared confirmation dialog', () => {
  assert.equal(fs.existsSync('app/portal/members/ConfirmActionModal.tsx'), false);
  const fields = fs.readFileSync('app/portal/field-management/FieldManagementTable.tsx', 'utf8');
  assert.match(fields, /@\/components\/ui\/confirm-action-modal/);
  assert.doesNotMatch(fields, /members\/ConfirmActionModal/);
});

