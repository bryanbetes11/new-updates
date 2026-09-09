import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const handlers = new Map();
let windows = [], opened, navigated, focused = false;
const origin = 'https://example.test';
runInNewContext(await readFile(new URL('../public/sw.js',import.meta.url),'utf8'), {
  URL, console, self: {location: {href: `${origin}/sw.js?v=test`,origin}, addEventListener: (name, fn) => handlers.set(name,fn)},
  clients: {matchAll: async () => windows, openWindow: async url => {opened=url;}},
});
async function click(data) {
  let done;
  handlers.get('notificationclick')({notification:{data,close(){}},waitUntil: promise => {done=promise;}});
  await done;
}
const id = '00000000-0000-4000-8000-000000000031';
await click({url:'/events/example?view=team#members',notification_id:id,notification_type:'event_created'});
assert.equal(new URL(opened).searchParams.get('_notification_open'),id);
assert.equal(new URL(opened).searchParams.get('view'),'team');
assert.equal(new URL(opened).hash,'#members');
windows=[{navigate:async url => {navigated=url;return {focus:async()=>{focused=true;}};},focus:async()=>{focused=true;}}];
await click({url:'/notifications',notification_id:id});
assert.equal(new URL(navigated).searchParams.get('_notification_open'),id);
assert.equal(focused,true,'existing client navigates before focus');
windows=[];
await click({url:'https://elsewhere.test',notification_id:id});
assert.equal(new URL(opened).origin,origin,'destination remains in app');
await click({url:'/messages',notification_id:id,notification_type:'message'});
assert.equal(new URL(opened).searchParams.has('_notification_open'),false,'private chat is not tracked');
await click({url:'/notifications',notification_id:'invalid'});
assert.equal(new URL(opened).searchParams.has('_notification_open'),false);
console.log('PASS push handoff: closed app, existing client, source marker, query/hash preservation and boundaries');
