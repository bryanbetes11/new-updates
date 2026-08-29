import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/pages/Requests.tsx'), 'utf8');

assert.match(
  source,
  /from\('events'\)[\s\S]*?select\('id,title,event_date,start_time,end_time,event_type'\)[\s\S]*?gte\('event_date', today\)/,
  'leave queue should load upcoming event details for leave planning',
);

assert.ok(
  source.split('<EventScheduleDuringLeave').length - 1 >= 2,
  'event context should appear on both pending and approved leave cards',
);

assert.doesNotMatch(source, /Song leader:/, 'event rows should not repeat a song leader already communicated by the event title');
assert.doesNotMatch(source, /rounded-xl border border-white/, 'events should render as a flat separated list, not nested cards');
assert.match(source, /const showEventDate = getLeaveStart\(request\) !== getLeaveEnd\(request\)/, 'single-day leave cards should not repeat the same date in every event row');
assert.match(source, /showEventDate[\s\S]*?event\.event_date[\s\S]*?time \|\| 'Time TBA'/, 'range leaves should retain event dates with the time directly beneath');
assert.match(source, /lg:grid-cols-\[minmax\(0,1\.1fr\)_minmax\(290px,0\.75fr\)_minmax\(190px,0\.45fr\)\]/, 'pending requests should use dedicated details, event, and decision columns on desktop');

assert.match(
  source,
  /function getApprovedLeaveConflicts[\s\S]*?approvedLeave\.user_id === target\.user_id[\s\S]*?approvedStart <= targetEnd && targetStart <= approvedEnd/,
  'pending warnings should detect other members with inclusive approved-leave overlap',
);
assert.match(source, /Coverage warning/, 'pending leave cards should surface an approved-leave warning');
assert.match(source, /Consider moving the rehearsal if possible/, 'warnings should suggest moving a rehearsal when appropriate');
assert.equal(
  source.split('<LeaveConflictWarning').length - 1,
  2,
  'approved-leave conflict warnings should render in both pending and approved leave lists',
);
assert.match(source, /context="pending"/, 'pending leave warnings should use pre-approval guidance');
assert.match(source, /context="approved"/, 'approved leave warnings should use post-approval planning guidance');
assert.match(source, /display="badge"/, 'pending coverage warnings should collapse into a compact badge');
assert.match(source, /aria-haspopup="dialog"/, 'the coverage badge should advertise its warning dialog');
assert.match(source, /title="Coverage warning"/, 'clicking the coverage badge should open the full warning in a modal');
assert.match(
  source,
  /<EventScheduleDuringLeave[\s\S]*?<LeaveConflictWarning[\s\S]*?context="approved"/,
  'approved leave warnings should follow the event schedule at the bottom of each card',
);
assert.match(source, /function groupApprovedLeavesByPeriod/, 'approved leaves should be grouped by matching date periods');
assert.match(source, /groupedRequests=\{group\.requests\}/, 'a shared leave period should produce one consolidated coverage warning');
assert.match(source, /Shared leave coverage/, 'matching leave periods should have a clear shared-card heading');
assert.match(source, /group\.requests\.length === 1 \? 'member' : 'members'\} away/, 'leave cards should communicate how many members are unavailable with correct grammar');
assert.match(source, /isSharedPeriod \? 'Shared leave coverage' : 'Leave coverage'/, 'every approved card should use the same date-first coverage header');
assert.match(source, /text-sm font-black[\s\S]*?sm:text-base/, 'approved leave dates should be visually prominent');
