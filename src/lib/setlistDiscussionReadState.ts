export interface SetlistDiscussionActivity {
  created_at: string;
  updated_at?: string | null;
}

export function setlistDiscussionCommentActivityAt(comment: SetlistDiscussionActivity): string {
  return comment.updated_at && Date.parse(comment.updated_at) > Date.parse(comment.created_at)
    ? comment.updated_at : comment.created_at;
}

export interface SetlistDiscussionRead {
  setlist_id: string;
  user_id: string;
  viewed_at: string;
  last_viewed_at: string;
}

/** Keep historical readers visible; recency is a separate label. */
export function allSetlistDiscussionViewers<T extends SetlistDiscussionRead>(views: readonly T[], setlistId: string): T[] {
  const latestByUser = new Map<string, T>();
  for (const view of views) {
    if (view.setlist_id !== setlistId) continue;
    const previous = latestByUser.get(view.user_id);
    if (!previous || Date.parse(view.last_viewed_at || view.viewed_at) > Date.parse(previous.last_viewed_at || previous.viewed_at)) {
      latestByUser.set(view.user_id, view);
    }
  }
  return [...latestByUser.values()].sort((a, b) => Date.parse(b.last_viewed_at || b.viewed_at) - Date.parse(a.last_viewed_at || a.viewed_at));
}

// Review decisions and comments both add material to the same discussion card.
export function latestSetlistDiscussionActivityAt(
  reviewedAt: string | null | undefined,
  comments: readonly SetlistDiscussionActivity[],
): string | null {
  let latest = reviewedAt ?? null;
  for (const comment of comments) {
    const activityAt = setlistDiscussionCommentActivityAt(comment);
    if (!latest || Date.parse(activityAt) > Date.parse(latest)) latest = activityAt;
  }
  return latest;
}

export function currentSetlistDiscussionViewers<T extends SetlistDiscussionRead>(
  views: readonly T[],
  setlistId: string,
  latestActivityAt: string | null,
): T[] {
  if (!latestActivityAt) return [];
  const activityTime = Date.parse(latestActivityAt);
  const latestByUser = new Map<string, T>();
  for (const view of views) {
    if (view.setlist_id !== setlistId || Date.parse(view.last_viewed_at) < activityTime) continue;
    const previous = latestByUser.get(view.user_id);
    if (!previous || Date.parse(view.last_viewed_at) > Date.parse(previous.last_viewed_at)) {
      latestByUser.set(view.user_id, view);
    }
  }
  return [...latestByUser.values()].sort(
    (left, right) => Date.parse(right.last_viewed_at) - Date.parse(left.last_viewed_at),
  );
}

export function shouldRecordSetlistDiscussionRead(
  views: readonly SetlistDiscussionRead[],
  setlistId: string,
  userId: string,
  latestActivityAt: string | null,
): boolean {
  if (!latestActivityAt) return false;
  return !currentSetlistDiscussionViewers(views, setlistId, latestActivityAt)
    .some(view => view.user_id === userId);
}
