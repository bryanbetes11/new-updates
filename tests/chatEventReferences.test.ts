import assert from 'node:assert/strict';
import {
  createChatEventReference,
  getChatCommandQuery,
  parseChatEventReference,
} from '../src/lib/chatEventReferences';

const event = {
  id: 'event-1',
  title: 'Sunday Service',
  event_date: '2026-08-23',
  event_type: 'Sunday Service',
  songs: [
    { id: 'song-1', title: 'Forever', artist: 'Chris Tomlin', performed_key: 'D', song_key: 'C' },
    { id: 'song-2', title: 'I Speak Jesus', artist: 'Charity Gayle', performed_key: null, song_key: 'A' },
  ],
};

assert.equal(getChatCommandQuery('/'), '');
assert.equal(getChatCommandQuery('/so'), 'so');
assert.equal(getChatCommandQuery('please /song'), null);
assert.equal(getChatCommandQuery('/song Forever'), null);

const eventReference = parseChatEventReference(JSON.parse(createChatEventReference('event', event)));
assert.equal(eventReference?.reference, 'event');
assert.equal(eventReference?.eventId, event.id);

const setlistReference = parseChatEventReference(JSON.parse(createChatEventReference('setlist', event)));
assert.equal(setlistReference?.songCount, 2);
assert.deepEqual(setlistReference?.songTitles, ['Forever', 'I Speak Jesus']);

const songReference = parseChatEventReference(JSON.parse(createChatEventReference('song', event, event.songs[0])));
assert.equal(songReference?.song?.title, 'Forever');
assert.equal(songReference?.song?.key, 'D');

const inlineSongReference = parseChatEventReference(JSON.parse(
  createChatEventReference('song', event, event.songs[0], 'Can we use ♪ Forever for the opening?'),
));
assert.equal(inlineSongReference?.messageText, 'Can we use ♪ Forever for the opening?');

assert.equal(parseChatEventReference({ type: 'event_reference', reference: 'song', eventId: '1', eventTitle: 'x', eventDate: '2026-01-01' }), null);
assert.equal(parseChatEventReference({ type: 'event_reference', reference: 'unknown', eventId: '1', eventTitle: 'x', eventDate: '2026-01-01' }), null);

console.log('chatEventReferences tests passed');
