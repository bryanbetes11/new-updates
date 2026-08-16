import type { PostEventObservationView } from '../types';

export function getPostEventObservationViewers(
  views: readonly PostEventObservationView[] | null | undefined,
  authorId: string
) {
  const latestViewByUser = new Map<string, PostEventObservationView>();

  for (const view of views || []) {
    if (view.user_id === authorId) continue;

    const previousView = latestViewByUser.get(view.user_id);
    if (!previousView || view.viewed_at > previousView.viewed_at) {
      latestViewByUser.set(view.user_id, view);
    }
  }

  return Array.from(latestViewByUser.values()).sort((left, right) => (
    right.viewed_at.localeCompare(left.viewed_at)
  ));
}
