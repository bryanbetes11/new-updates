import assert from 'node:assert/strict';
import { resolveSetlistEvent } from '../src/lib/sharedSetlist';

const service = { id: 'service', event_type: 'Sunday Service', org_id: 'church', linked_event_id: null as string | null, event_date: '2026-09-27' };
const rehearsal = { id: 'rehearsal', event_type: 'Rehearsals', org_id: 'church', linked_event_id: 'service', event_date: '2026-09-26' };
assert.equal(resolveSetlistEvent(rehearsal, service), service, 'Rehearsal uses the identical service owner and date');
assert.equal(resolveSetlistEvent(service), service, 'Sunday Service owns its proposal');
assert.equal(resolveSetlistEvent({ ...rehearsal, linked_event_id: null }).id, 'rehearsal', 'Standalone rehearsals remain independent');
assert.throws(() => resolveSetlistEvent(rehearsal), /linked Sunday Service/, 'Missing link must not create a separate proposal');
assert.throws(() => resolveSetlistEvent(rehearsal, { ...service, org_id: 'other' }), /linked Sunday Service/, 'Cross-church links are rejected');
assert.throws(() => resolveSetlistEvent(rehearsal, { ...service, id: 'other' }), /linked Sunday Service/, 'Wrong target is rejected');
assert.throws(() => resolveSetlistEvent(rehearsal, { ...service, event_type: 'Rehearsals' }), /linked Sunday Service/, 'Rehearsal chains are rejected');
