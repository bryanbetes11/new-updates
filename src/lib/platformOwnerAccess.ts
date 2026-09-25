export type PlatformOwnerAccess = { userId: string; allowed: boolean };

export async function loadPlatformOwnerAccess(
  userId: string,
  lookup: () => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<PlatformOwnerAccess> {
  try {
    const result = await lookup();
    return { userId, allowed: !result.error && result.data === true };
  } catch {
    return { userId, allowed: false };
  }
}

export function hasPlatformOwnerAccess(
  access: PlatformOwnerAccess | null,
  userId: string | undefined,
  offline: boolean,
): boolean {
  return !offline && !!userId && access?.userId === userId && access.allowed;
}
