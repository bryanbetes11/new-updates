import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';

export interface SetlistReviewAge {
  submittedDateLabel: string;
  pendingDaysLabel: string;
  pendingDays: number | null;
}

export function describeSetlistReviewAge(submittedAt: string | null | undefined, now = new Date()): SetlistReviewAge {
  if (!submittedAt) {
    return {
      submittedDateLabel: 'Submission date unavailable',
      pendingDaysLabel: 'Pending age unavailable',
      pendingDays: null,
    };
  }

  const submittedDate = parseISO(submittedAt);
  if (!isValid(submittedDate)) {
    return {
      submittedDateLabel: 'Submission date unavailable',
      pendingDaysLabel: 'Pending age unavailable',
      pendingDays: null,
    };
  }

  const pendingDays = Math.max(0, differenceInCalendarDays(now, submittedDate));

  return {
    submittedDateLabel: format(submittedDate, 'MMM d, yyyy'),
    pendingDaysLabel: pendingDays === 0 ? 'Pending today' : `Pending ${pendingDays} ${pendingDays === 1 ? 'day' : 'days'}`,
    pendingDays,
  };
}

export function getSetlistPendingMessage(reviewAge: SetlistReviewAge, isCurrentUserSubmitter = false): string | null {
  if (reviewAge.pendingDays === null) return null;

  if (reviewAge.pendingDays === 0) {
    return isCurrentUserSubmitter ? 'Your setlist is pending today' : 'Setlist pending today';
  }

  const daysLabel = `${reviewAge.pendingDays} ${reviewAge.pendingDays === 1 ? 'day' : 'days'}`;
  return isCurrentUserSubmitter
    ? `Your setlist has been pending for ${daysLabel}`
    : `Setlist pending for ${daysLabel}`;
}
