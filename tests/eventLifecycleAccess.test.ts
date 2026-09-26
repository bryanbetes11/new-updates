import assert from 'node:assert/strict';
import { hasEventLifecycleAccess } from '../src/lib/eventLifecycleAccess';
import { hasPlatformOwnerAccess } from '../src/lib/platformOwnerAccess';

const online = {offline:false, rolePreview:false, isOrgAdmin:false, isAdmin:false, accountOrgId:'church-a', eventOrgId:'church-a'};
for (const email of ['bryanbetes11@gmail.com', 'fwd.bryanashleybetes@gmail.com', 'bryanashleybetes@gmail.com']) {
  assert.equal(hasEventLifecycleAccess({...online, authenticatedEmail:email}), true, 'All previously authorized event accounts retain the menu');
  assert.equal(hasEventLifecycleAccess({...online, authenticatedEmail:email, offline:true}), false, 'Offline accounts cannot change event status');
  assert.equal(hasEventLifecycleAccess({...online, authenticatedEmail:email, rolePreview:true}), false, 'Role previews cannot expose event management');
}
for (const email of [undefined, null, '', 'member@example.com', 'admin@example.com', 'bryanashleybetes@gmail.com.attacker.example']) {
  assert.equal(hasEventLifecycleAccess({...online, authenticatedEmail:email}), false, 'Other accounts and lookalike addresses remain ineligible');
}
assert.equal(hasEventLifecycleAccess({...online, authenticatedEmail:' BryanAshleyBetes@Gmail.com '}), true);
assert.equal(hasPlatformOwnerAccess({userId:'bryan',allowed:false},'bryan',false), false, 'Restoring event access must not grant platform administration');
assert.equal(hasEventLifecycleAccess({...online, authenticatedEmail:'member@example.com'}), false, 'Switching away from an authorized account does not retain access');

for (const role of [{isOrgAdmin:true}, {isAdmin:true}]) {
  const admin = {...online, ...role, authenticatedEmail:'church-admin@example.com'};
  assert.equal(hasEventLifecycleAccess(admin), true, 'Church admins and Admin-role users can manage their own church events');
  assert.equal(hasEventLifecycleAccess({...admin, eventOrgId:'church-b'}), false, 'Admin access cannot cross church boundaries');
  assert.equal(hasEventLifecycleAccess({...admin, offline:true}), false);
  assert.equal(hasEventLifecycleAccess({...admin, rolePreview:true}), false);
  for (const missing of [undefined, null, '']) {
    assert.equal(hasEventLifecycleAccess({...admin, accountOrgId:missing}), false, 'An admin needs a resolved account church');
    assert.equal(hasEventLifecycleAccess({...admin, eventOrgId:missing}), false, 'An admin needs a resolved event church');
    assert.equal(hasEventLifecycleAccess({...admin, accountOrgId:missing, eventOrgId:missing}), false);
  }
}
