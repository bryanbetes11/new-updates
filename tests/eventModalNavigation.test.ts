import assert from 'node:assert/strict';
import type { Location } from 'react-router-dom';
import { eventModalNavigationOptions, isEventModalBackgroundPath } from '../src/lib/eventModalNavigation';

const announcements: Location = { pathname: '/announcements', search: '?filter=all', hash: '', state: null, key: 'background' };
const options = eventModalNavigationOptions('/events/event?tab=team', announcements, true);
assert.deepEqual(options?.state, { backgroundLocation: announcements, returnTo: '/announcements?filter=all' });
const existingModal: Location = { ...announcements, pathname: '/events/first', search: '?tab=setlist', state: { backgroundLocation: announcements } };
assert.equal(eventModalNavigationOptions('/events/second', existingModal, true)?.state.backgroundLocation, announcements, 'reuse the underlying screen when opening another notification');
const direct: Location = { ...existingModal, state: null };
assert.equal(eventModalNavigationOptions('/events/second', direct, true)?.state.backgroundLocation.pathname, '/events', 'direct details route uses Events as the modal background');
assert.equal(eventModalNavigationOptions('/events/event', announcements, false), undefined, 'mobile navigation remains a page');
for (const path of ['/events', '/messages/chat', '/events/event/team', 'https://elsewhere.test/events/event']) {
  assert.equal(eventModalNavigationOptions(path, announcements, true), undefined);
}
for (const path of ['/login', '/auth/callback', '/preview/event', '//external', '/events/event', '/announcements/post']) assert.equal(isEventModalBackgroundPath(path), false);
for (const path of ['/events', '/dashboard', '/announcements', '/notifications', '/leadership/team']) assert.equal(isEventModalBackgroundPath(path), true);
