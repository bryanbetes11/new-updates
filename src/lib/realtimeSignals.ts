export const BADGE_COUNTS_REFRESH_EVENT = 'badge-counts-refresh';
export const CONVERSATIONS_REFRESH_EVENT = 'conversations-refresh';

export function dispatchBadgeCountsRefresh() {
  window.dispatchEvent(new Event(BADGE_COUNTS_REFRESH_EVENT));
}

export function dispatchConversationsRefresh() {
  window.dispatchEvent(new Event(CONVERSATIONS_REFRESH_EVENT));
}

export function dispatchMessagingRefresh() {
  dispatchBadgeCountsRefresh();
  dispatchConversationsRefresh();
}
