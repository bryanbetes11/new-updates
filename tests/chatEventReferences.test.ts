import assert from 'node:assert/strict';
import {
  createChatEventReference,
  getChatCommandQuery,
  getInlineSongShortcut,
  getInlineSongSegments,
  getSongYoutubeTarget,
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
assert.deepEqual(getInlineSongShortcut('Use /Behold'), { start: 4, query: 'behold' });
assert.deepEqual(getInlineSongShortcut('Then /Lord I need You'), { start: 5, query: 'lord i need you' });
assert.deepEqual(getInlineSongShortcut('Use /song Forever'), { start: 4, query: 'forever' });
assert.equal(getInlineSongShortcut('/set'), null);
assert.equal(getInlineSongShortcut('/observe'), null);
assert.equal(getSongYoutubeTarget({ id: '1', title: 'Forever', artist: 'Chris Tomlin', key: 'D', youtubeUrl: ' https://youtu.be/example ' }), 'https://youtu.be/example');
assert.equal(getSongYoutubeTarget({ id: '1', title: 'Forever', artist: 'Chris Tomlin', key: 'D' }), 'https://www.youtube.com/results?search_query=Forever%20Chris%20Tomlin');

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
  createChatEventReference('song', event, event.songs[0], 'Can we use ♪ Forever and ♪ I Speak Jesus for the opening?', event.songs),
));
assert.equal(inlineSongReference?.messageText, 'Can we use ♪ Forever and ♪ I Speak Jesus for the opening?');
assert.deepEqual(inlineSongReference?.songMentions?.map(song => song.title), ['Forever', 'I Speak Jesus']);

const segments = getInlineSongSegments(inlineSongReference?.messageText || '', inlineSongReference?.songMentions || []);
assert.deepEqual(segments.map(segment => segment.type === 'song' ? segment.song.title : segment.text), [
  'Can we use ',
  'Forever',
  ' and ',
  'I Speak Jesus',
  ' for the opening?',
]);
assert.deepEqual(
  getInlineSongSegments('♪Forever then ♪ I Speak Jesus', inlineSongReference?.songMentions || [])
    .filter(segment => segment.type === 'song')
    .map(segment => segment.type === 'song' ? segment.song.title : ''),
  ['Forever', 'I Speak Jesus'],
);
assert.equal(
  getInlineSongSegments('Use ♪ Behold (This is Jesus here', [{ id: '3', title: 'Behold (This is Jesus)', artist: null, key: 'C' }])
    .some(segment => segment.type === 'song' && segment.song.id === '3'),
  true,
);

assert.equal(parseChatEventReference({ type: 'event_reference', reference: 'song', eventId: '1', eventTitle: 'x', eventDate: '2026-01-01' }), null);
assert.equal(parseChatEventReference({ type: 'event_reference', reference: 'unknown', eventId: '1', eventTitle: 'x', eventDate: '2026-01-01' }), null);

console.log('chatEventReferences tests passed');
