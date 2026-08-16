import { getPostEventObservationViewers } from '../src/lib/postEventObservationViews';
import type { PostEventObservationView } from '../src/types';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

const authorId = 'author-1';

expectEqual(
  getPostEventObservationViewers(undefined, authorId).length,
  0,
  'handles a missing view list'
);

expectEqual(
  getPostEventObservationViewers([
    { observation_id: 'observation-1', user_id: authorId, viewed_at: '2026-08-16T01:00:00.000Z' },
  ], authorId).length,
  0,
  'excludes the observation author'
);

const views: PostEventObservationView[] = [
  { observation_id: 'observation-1', user_id: 'reader-1', viewed_at: '2026-08-16T01:00:00.000Z' },
  { observation_id: 'observation-1', user_id: 'reader-2', viewed_at: '2026-08-16T03:00:00.000Z' },
  { observation_id: 'observation-1', user_id: 'reader-1', viewed_at: '2026-08-16T02:00:00.000Z' },
  { observation_id: 'observation-1', user_id: authorId, viewed_at: '2026-08-16T04:00:00.000Z' },
];
const originalOrder = views.map(view => view.viewed_at).join(',');
const viewers = getPostEventObservationViewers(views, authorId);

expectEqual(viewers.length, 2, 'deduplicates readers and excludes the author');
expectEqual(viewers[0]?.user_id, 'reader-2', 'sorts the newest reader first');
expectEqual(viewers[1]?.user_id, 'reader-1', 'keeps each reader once');
expectEqual(viewers[1]?.viewed_at, '2026-08-16T02:00:00.000Z', 'keeps the latest duplicate receipt');
expectEqual(views.map(view => view.viewed_at).join(','), originalOrder, 'does not mutate the input order');
