export const APP_VERSION = '2026.05.11.20';
export const APP_UPDATE_VERSION = APP_VERSION;
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const APP_UPDATE_PUBLISHED_AT = '2026-05-11T16:50:00Z';

export const APP_UPDATE_FEATURES = [
  'Five-question test now marks a song Approved only when all five questions pass; partial passes show Approved with Caution.',
  'Five-question song statuses now follow simpler leader-review rules and use cleaner labels in the checker report.',
  'Setlist Checker now saves the latest result on the setlist so leaders can reopen it later without rerunning the check.',
  'Setlist Checker now summarizes five-question song flags more clearly and skips false theme-alignment warnings when no service theme was provided.',
  'Song lyrics search now works even when a song has no artist, and search results appear in a compact scrollable picker before you choose one.',
  'Song lyrics modal can now search LRCLIB results by song title and artist and let you choose the correct lyrics before saving.',
  'Each setlist song now shows a visible lyrics-needed indicator and highlighted lyrics action when lyrics are missing.',
  'Setlist creators now must add lyrics to every song before they can check or submit a setlist.',
  'Tap any photo in chat to view it full-screen.',
  'Open PDFs and Office documents directly in the app.',
  'Single + button in chat for attaching photos or files.',
  'Long-press a message on mobile to reply, react, copy, pin, or delete.',
  'Event chats now list upcoming events sorted by nearest date.',
  'Chat info panel shows shared media, files, and links.',
  'Event group chats now show members with add and remove options.',
  'Tapping the event card in chat opens a focused event + setlist view.',
  'New Worship Setlist Checker — runs a full MCJC theological analysis on your setlist before submitting, with a verdict, flow check, slot-fit review, and gospel-centeredness score.',
];

export const APP_UPDATE_FIXES = [
  'Setlist Checker badges now keep better sizing in Flow Check, and priority labels no longer show underscores.',
  'Setlist Checker flow-check cards now use stronger hierarchy, cleaner song lists, and better-designed count badges.',
  'Setlist Checker flow-check cards now use cleaner status chips instead of the old green side accents.',
  'Partial-pass five-question songs now display an Approved badge with a distinct caution style instead of showing Approved with Caution text.',
  'Setlist checking now handles missing submission storage more safely while the saved-result table is being brought live.',
  'Five-question test badges now show Pass or Fail wording more clearly in the checker report.',
  'Desktop toast notifications no longer block clicks on the page while they are visible.',
  'Development localhost now unregisters old service workers automatically to prevent stale reload behavior.',
  'Song lyrics can now be saved even when the song was originally created by another user.',
  'Hardened the PWA update check to prevent delayed blank-page reloads after opening the dashboard.',
  'Reply preview now overlaps the message bubble and shows content only.',
  'Keyboard no longer dismisses before sending a message on mobile.',
  'Push notifications now show your organisation name for chat messages.',
  'Event detail setlist desktop layout: songs column no longer gets squeezed.',
  'Review notes and revision history are now hidden once a setlist is approved.',
  'Editing an approved setlist (add, remove, reorder, or update songs) now requires re-approval and notifies the approver.',
  'Chat seen receipts now include your own avatar under messages you have read, and show accurately for all participants.',
];
