export interface SongProposalSetlistRow {
  id: string;
  event_id: string;
  status: string;
  submitted_at: string | null;
  events: { title: string; event_date: string } | Array<{ title: string; event_date: string }> | null;
  submitter: { first_name: string | null; last_name: string | null } | Array<{ first_name: string | null; last_name: string | null }> | null;
  setlist_songs: Array<{ song_id: string }>;
}

export interface SongProposalSubmission {
  setlistId: string;
  eventId: string;
  status: string;
  submittedAt: string;
  submitterName: string;
  eventTitle: string;
  eventDate: string;
}

export interface SongProposalConflict {
  currentSubmission: SongProposalSubmission;
  firstSubmission: SongProposalSubmission;
  otherSubmissions: SongProposalSubmission[];
  totalSubmissions: number;
}

export interface SongProposalReservation {
  firstSubmission: SongProposalSubmission;
  totalSubmissions: number;
}

function firstRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (Array.isArray(relation)) return relation[0] || null;
  return relation || null;
}

function toSubmission(row: SongProposalSetlistRow): SongProposalSubmission | null {
  if (!row.submitted_at || !Number.isFinite(Date.parse(row.submitted_at))) return null;

  const event = firstRelation(row.events);
  const submitter = firstRelation(row.submitter);
  const submitterName = [submitter?.first_name, submitter?.last_name].filter(Boolean).join(' ').trim();

  return {
    setlistId: row.id,
    eventId: row.event_id,
    status: row.status,
    submittedAt: row.submitted_at,
    submitterName: submitterName || event?.title || 'Another song leader',
    eventTitle: event?.title || 'Untitled event',
    eventDate: event?.event_date || '',
  };
}

function groupSongProposalSubmissions(rows: SongProposalSetlistRow[]) {
  const submissionsBySong = new Map<string, Map<string, SongProposalSubmission>>();

  rows.forEach(row => {
    const submission = toSubmission(row);
    if (!submission) return;

    row.setlist_songs.forEach(({ song_id: songId }) => {
      if (!songId) return;
      const submissions = submissionsBySong.get(songId) || new Map<string, SongProposalSubmission>();
      submissions.set(row.id, submission);
      submissionsBySong.set(songId, submissions);
    });
  });

  return submissionsBySong;
}

function sortSubmissions(submissions: Iterable<SongProposalSubmission>) {
  return Array.from(submissions).sort((left, right) => {
    const timeDifference = Date.parse(left.submittedAt) - Date.parse(right.submittedAt);
    return timeDifference || left.setlistId.localeCompare(right.setlistId);
  });
}

export function buildSongProposalConflicts(
  rows: SongProposalSetlistRow[],
  currentSetlistId: string | null | undefined,
): Record<string, SongProposalConflict> {
  if (!currentSetlistId) return {};

  const submissionsBySong = groupSongProposalSubmissions(rows);

  const conflicts: Record<string, SongProposalConflict> = {};

  submissionsBySong.forEach((submissions, songId) => {
    const ordered = sortSubmissions(submissions.values());
    const currentSubmission = ordered.find(submission => submission.setlistId === currentSetlistId);

    if (!currentSubmission || ordered.length < 2) return;

    conflicts[songId] = {
      currentSubmission,
      firstSubmission: ordered[0],
      otherSubmissions: ordered.filter(submission => submission.setlistId !== currentSetlistId),
      totalSubmissions: ordered.length,
    };
  });

  return conflicts;
}

export function buildSongProposalReservations(
  rows: SongProposalSetlistRow[],
  currentSetlistId: string | null | undefined,
): Record<string, SongProposalReservation> {
  const reservations: Record<string, SongProposalReservation> = {};

  groupSongProposalSubmissions(rows).forEach((submissions, songId) => {
    const otherSubmissions = sortSubmissions(
      Array.from(submissions.values()).filter(submission => submission.setlistId !== currentSetlistId),
    );
    if (otherSubmissions.length === 0) return;

    reservations[songId] = {
      firstSubmission: otherSubmissions[0],
      totalSubmissions: otherSubmissions.length,
    };
  });

  return reservations;
}
