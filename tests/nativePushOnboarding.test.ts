import assert from 'node:assert/strict';
import { createNativePushOnboarding, type NativePushPromptState } from '../src/lib/nativePushOnboarding';

function fixture() {
  const state = {
    owner: null as string | null, installation: false, user: 'alice', preference: true,
    marker: null as NativePushPromptState | null,
    permission: 'prompt' as 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied',
    answer: 'granted' as 'prompt' | 'granted' | 'denied',
    prompts: 0, registrations: 0, failRegistration: false,
    onPrompt: async () => {},
  };
  const run = createNativePushOnboarding({
    owner: () => state.owner, hasInstallation: () => state.installation,
    currentUser: async () => state.user, state: () => state.marker,
    saveState: (_user, marker) => { state.marker = marker; },
    preferenceEnabled: async () => state.preference,
    permission: async () => state.permission,
    requestPermission: async () => { state.prompts++; await state.onPrompt(); state.permission = state.answer; return state.answer; },
    enable: async () => {
      state.registrations++;
      if (state.failRegistration) throw new Error('offline');
      state.owner = state.user;
      state.installation = true;
      return true;
    },
  });
  return { state, run };
}

{
  const { state, run } = fixture();
  await Promise.all([run('alice'), run('alice'), run('alice')]);
  await run('alice');
  assert.equal(state.prompts, 1, 'concurrent mount/resume events show one OS dialog');
  assert.equal(state.registrations, 1, 'Allow registers the device automatically');
  assert.equal(state.marker, 'done');
}
for (const answer of ['denied', 'prompt'] as const) {
  const { state, run } = fixture(); state.answer = answer;
  await run('alice'); await run('alice');
  assert.equal(state.prompts, 1, 'decline/dismissal does not nag on resume');
  assert.equal(state.registrations, 0);
}
for (const permission of ['denied', 'prompt-with-rationale'] as const) {
  const { state, run } = fixture(); state.permission = permission;
  await run('alice');
  assert.equal(state.prompts, 0, 'previously denied permission is respected');
  assert.equal(state.registrations, 0);
}
{
  const { state, run } = fixture(); state.permission = 'granted';
  await run('alice');
  assert.equal(state.prompts, 0, 'granted permission requires no dialog');
  assert.equal(state.registrations, 1);
}
{
  const { state, run } = fixture(); state.preference = false;
  await run('alice');
  assert.equal(state.prompts + state.registrations, 0, 'account-wide opt-out is respected');
}
{
  const { state, run } = fixture(); state.installation = true;
  await run('alice');
  assert.equal(state.prompts + state.registrations, 0, 'legacy disabled/signed-out installation is not automatically reclaimed');
}
{
  const { state, run } = fixture(); state.user = 'bob';
  await run('alice');
  assert.equal(state.prompts + state.registrations, 0, 'stale account cannot trigger onboarding');
}
{
  const { state, run } = fixture(); state.onPrompt = async () => { state.user = 'bob'; };
  await run('alice');
  assert.equal(state.registrations, 0, 'account change during dialog cannot register the wrong account');
}
{
  const { state, run } = fixture(); state.onPrompt = async () => { state.marker = 'done'; };
  await run('alice');
  assert.equal(state.registrations, 0, 'manual opt-out during dialog wins over automatic registration');
}
{
  const { state, run } = fixture(); state.failRegistration = true;
  await assert.rejects(run('alice'), /offline/);
  state.failRegistration = false;
  await run('alice');
  assert.equal(state.prompts, 1, 'registration retry reuses permission without repeating the dialog');
  assert.equal(state.registrations, 2);
  assert.equal(state.marker, 'done');
}
