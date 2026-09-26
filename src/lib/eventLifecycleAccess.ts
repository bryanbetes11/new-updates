// Match the existing "Platform owner can update event lifecycle" database
// policy (20260813000100). These event permissions are intentionally separate
// from the narrower is_platform_owner() permission for platform administration.
const eventLifecycleEmails = new Set([
  'bryanbetes11@gmail.com',
  'fwd.bryanashleybetes@gmail.com',
  'bryanashleybetes@gmail.com',
]);

export function hasEventLifecycleAccess({
  authenticatedEmail,
  isOrgAdmin,
  isAdmin,
  accountOrgId,
  eventOrgId,
  offline,
  rolePreview,
}: {
  authenticatedEmail: string | null | undefined;
  isOrgAdmin: boolean;
  isAdmin: boolean;
  accountOrgId: string | null | undefined;
  eventOrgId: string | null | undefined;
  offline: boolean;
  rolePreview: boolean;
}): boolean {
  // Use the authenticated user's email, never editable profile metadata.
  // This controls the UI only; database policies still authorize every write.
  const isSameOrgAdmin = (isOrgAdmin || isAdmin) && Boolean(accountOrgId)
    && accountOrgId === eventOrgId;
  return !offline && !rolePreview && (isSameOrgAdmin
    || eventLifecycleEmails.has((authenticatedEmail || '').trim().toLowerCase()));
}
