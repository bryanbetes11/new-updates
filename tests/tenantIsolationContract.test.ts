import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const migration = readFileSync(resolve(root, 'supabase/migrations/20260825190327_enable_multi_church_onboarding.sql'), 'utf8');
const protectedRoute = readFileSync(resolve(root, 'src/components/ProtectedRoute.tsx'), 'utf8');
const createChurch = readFileSync(resolve(root, 'src/pages/CreateChurch.tsx'), 'utf8');

const requiredTenantContracts = [
  /conversation_members_conversation_org_fkey/i,
  /messages_conversation_org_fkey/i,
  /message_reactions_message_org_fkey/i,
  /active_conversation_views_conversation_org_fkey/i,
  /event_messages_event_org_fkey/i,
  /create or replace function public\.create_personal_conversation/i,
  /create or replace function public\.create_group_conversation/i,
  /create or replace function public\.create_organization_for_current_user/i,
  /create or replace function public\.set_org_member_admin/i,
  /create or replace function public\.submit_organization_payment/i,
  /revoke insert, update on public\.profiles from authenticated[\s\S]*?grant update \([\s\S]*?updated_at[\s\S]*?\) on public\.profiles to authenticated/i,
  /revoke update on public\.organizations from authenticated[\s\S]*?grant update \(name, logo_url\) on public\.organizations to authenticated/i,
];

for (const contract of requiredTenantContracts) {
  assert.match(migration, contract, `tenant safety contract is missing: ${contract}`);
}

assert.match(protectedRoute, /!hasOrganization[\s\S]*Navigate to="\/create-church"/, 'organization-less users must remain outside protected church routes');
assert.match(createChurch, /create_organization_for_current_user/, 'church creation must continue through the guarded database function');
assert.doesNotMatch(createChurch, /\.from\(['"]organizations['"]\)\.insert/, 'the browser must not create organization rows directly');
