import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { loadWidgetSnapshot } from '../src/lib/loadWidgetSnapshot';

const requests: URL[] = [];
let failNews = false;
const client = createClient('https://widget-fixture.invalid', 'fixture-publishable-key', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: async (input, init) => {
    assert.equal(init?.method ?? 'GET', 'GET', 'widgets never write team data');
    const url = new URL(String(input)); requests.push(url);
    if (url.pathname.endsWith('/announcements') && failNews) return new Response(JSON.stringify({ message: 'Denied', code: '42501' }), { status: 403 });
    const event = { id: 'event-1', org_id: 'church-a', title: 'Sunday Worship', event_date: '2099-10-11', start_time: '09:00:00' };
    let data: unknown[] = [];
    if (url.pathname.endsWith('/event_assignments')) data = [{ id: 'a1', user_id: 'member-a', status: 'pending', events: event, roles: { name: 'Keys' } }];
    if (url.pathname.endsWith('/setlists')) data = [{ id: 's1', events: event, setlist_songs: [
      { position: 2, performed_key: 'D', songs: { title: 'Second song', song_key: 'C' } },
      { position: 1, performed_key: '', songs: { title: 'First song', song_key: 'G' } },
    ] }];
    if (url.pathname.endsWith('/announcements')) data = [{ id: 'n1', title: 'Team news', content: '<b>Welcome</b>', created_at: '2026-10-05' }];
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' } });
  } },
});
const snapshot = await loadWidgetSnapshot('member-a', 'church-a', 'scope-a', 'Test church', new AbortController().signal, client);
assert.equal(requests.length, 4);
for (const request of requests) {
  assert.ok(request.searchParams.get('org_id') === 'eq.church-a' || request.searchParams.get('events.org_id') === 'eq.church-a');
  if (request.pathname.endsWith('/event_assignments')) {
    assert.equal(request.searchParams.get('user_id'), 'eq.member-a');
    assert.equal(request.searchParams.get('order'), 'events(event_date).asc,events(start_time).asc');
  }
  if (request.pathname.endsWith('/announcements')) assert.equal(request.searchParams.get('or'), '(is_leaders_only.is.null,is_leaders_only.eq.false)');
  if (request.pathname.endsWith('/setlists')) assert.equal(request.searchParams.get('status'), 'eq.approved');
}
assert.deepEqual(snapshot.setlists[0].items, ['First song · G', 'Second song · D']);
assert.equal(snapshot.announcements[0].detail, 'Welcome');
assert.equal(snapshot.pendingCount, 1);
assert.deepEqual(snapshot.unavailable, []);
assert.ok(!JSON.stringify(snapshot).includes('fixture-publishable-key'));
failNews = true;
const partial = await loadWidgetSnapshot('member-a', 'church-a', 'scope-a', 'Test church', new AbortController().signal, client);
assert.deepEqual(partial.unavailable, ['announcements']); assert.deepEqual(partial.announcements, []); assert.equal(partial.assignments.length, 1);
const controller = new AbortController(); controller.abort();
await assert.rejects(loadWidgetSnapshot('member-a', 'church-a', 'scope-a', 'Test church', controller.signal, client), { name: 'AbortError' });
