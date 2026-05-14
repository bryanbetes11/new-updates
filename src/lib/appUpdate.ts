export const APP_VERSION = '2026.05.14.1';
export const APP_UPDATE_VERSION = APP_VERSION;
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
export const APP_UPDATE_PUBLISHED_AT = '2026-05-14T15:56:29Z';

export const APP_UPDATE_FEATURES = [
  'Chats now support @mentions, and mentioned users receive a dedicated mention notification with push delivery.',
  'New Worship Setlist Checker — review your setlist before submitting. It checks gospel clarity, worship flow, song slot fit, and gives an overall score based on MCJC\'s theological standards.',
  'Songs now need to pass all five review questions to be marked Approved. If only some pass, the song is marked Approved with Caution.',
  'Checker results are saved automatically — leaders can reopen the last report without having to run it again.',
  'Lyrics are now required for all songs before a setlist can be checked or submitted.',
  'Songs with missing lyrics now show a clear indicator so you know which ones still need to be filled in.',
  'Finding lyrics now works even when no artist is listed for a song. You can pick from a list of results before saving.',
  'Tap any photo in chat to view it full-screen.',
  'Open PDFs and documents directly in the app.',
  'Use the + button in chat to attach photos or files.',
  'Long-press any message on mobile to reply, react, copy, pin, or delete it.',
  'Tap the event card in a group chat to open the event details and setlist.',
  'You can now view, add, and remove members in event group chats.',
  'The chat info panel now shows shared photos, files, and links in one place.',
  'Events in group chats are now sorted by the nearest upcoming date.',
  'You can now leave a group chat from the info panel without deleting it for everyone.',
  'When creating a group chat, you can now give it a name right away and select all members with one tap.',
  'Event group chats now only allow adding members who are actually part of that event.',
];

export const APP_UPDATE_FIXES = [
  'Activity Log now refreshes while open and when returning to the app, so new create/delete activity appears without getting stuck on a stale load state.',
  'Chat push delivery now refreshes the service worker cleanly while keeping lockscreen notifications limited to when ServeSync is not visibly open.',
  'The desktop chat composer now uses the full available width while typing, so messages no longer wrap onto new lines too early.',
  'Mentioned names in chat now render cleanly instead of showing raw underscore handles.',
  'Pages throughout the app now open and close with smooth animations.',
  'Switching between Upcoming and Past Events on mobile now slides in the right direction.',
  'Setlist checker song cards are now better organised — labels on one row with the song title below.',
  'Category labels in the checker report are now properly capitalised and no longer show underscores.',
  'The worship flow check section is cleaner and easier to read.',
  'Songs that partially pass the five review questions now show a distinct caution badge.',
  'Pass and Fail labels in the checker report are now easier to read at a glance.',
  'Notifications no longer block you from clicking other parts of the page.',
  'You can now save lyrics to any song, even if someone else originally added it.',
  'Fixed an issue where the app would sometimes show a blank page when first opening.',
  'Reply previews in chat now look cleaner and less cluttered.',
  'Fixed an issue where the keyboard would close before your message was sent on mobile.',
  'Chat notifications now include your organisation\'s name.',
  'Fixed the setlist layout on larger screens where the songs column was getting too narrow.',
  'Review notes and history are now hidden after a setlist is approved, keeping things tidy.',
  'Making any change to an approved setlist now automatically sends it back for re-approval.',
  'Read receipts now correctly show everyone who has seen a message, including yourself.',
  'Filter tabs on My Assignments now match the app\'s pill button style instead of a segmented control.',
  'The Your Next Service card on the Dashboard is now compact. A new Setlist Preview card below it shows the upcoming service\'s song list for everyone, even if you\'re not assigned.',
  'You can now request a schedule swap with any team member. Both parties must agree before leadership reviews and approves or declines. Push notifications are sent at each step.',
];
