export interface NotificationCopy {
  title: string;
  body: string;
}

const copy: Record<string, NotificationCopy> = {
  assignment: {
    title: 'New Assignment',
    body: 'You have been assigned as [role] for [event] on [event date].',
  },
  assignment_response: {
    title: 'Assignment Confirmed / Declined',
    body: '[Member] has confirmed or declined their assignment for [event] on [event date].',
  },
  assignment_confirmation_reminder: {
    title: 'Confirm Your Assignment',
    body: 'You are still marked as pending for [role] in [event]. Please confirm or decline it in ServeSync today.',
  },
  assignment_removed: {
    title: 'Assignment Removed',
    body: 'Your [role] assignment for [event] has been removed.',
  },
  event_created: {
    title: 'New Event',
    body: '[Event] was added for [event date].',
  },
  event_updated: {
    title: 'Event Updated',
    body: '[Event] has updated schedule details for [event date].',
  },
  event_cancelled: {
    title: 'Event Cancelled',
    body: '[Event] on [event date] has been cancelled.',
  },
  event_reminder: {
    title: 'Event Tomorrow',
    body: 'Reminder: you are assigned to [event] tomorrow at [start time].',
  },
  event_today_reminder: {
    title: 'Event Today',
    body: 'You are assigned to [event] today at [start time].',
  },
  attendance_open: {
    title: 'Attendance is Now Open',
    body: 'Attendance for [event] is now open. Mark your attendance when you are already at church.',
  },
  attendance_reminder: {
    title: 'Attendance Reminder',
    body: 'You still need to mark your attendance for [event].',
  },
  attendance_five_min_reminder: {
    title: 'Attendance Reminder',
    body: '[Event] starts at [start time]. You still need to mark your attendance.',
  },
  attendance_grace_final_reminder: {
    title: 'Grace Period Ending Soon',
    body: '[Event] already started. You have about 1 minute left before the grace period closes.',
  },
  attendance_missed_evening_reminder: {
    title: 'Attendance Still Missing',
    body: 'Your attendance for [event] has not been submitted. Please update it in ServeSync.',
  },
  attendance_missed_final_reminder: {
    title: 'Attendance Not Submitted',
    body: 'Final reminder: your attendance for [event] is still missing.',
  },
  attendance_alert: {
    title: 'Attendance Alert',
    body: '[Member] has reached [offense level] for [quarter]. Action required: [next action].',
  },
  proposal_reminder: {
    title: 'Setlist Proposal Reminder',
    body: 'Submit the proposal for [event] on [event date] before 11:59 PM.',
  },
  proposal_overdue_alert: {
    title: 'Overdue Setlist Proposal',
    body: '[Song leader] still has not submitted the setlist proposal for [event]. Please follow up with them.',
  },
  leadership_member_action_reminder: {
    title: 'Members Need Follow-Up',
    body: '[Count] members need leadership follow-up today for proposals or attendance issues.',
  },
  setlist_submitted: {
    title: 'Setlist Submitted for Review',
    body: 'A setlist for [event] on [event date] is ready for review.',
  },
  setlist_approved: {
    title: 'Setlist Approved',
    body: 'The setlist for [event] has been approved.',
  },
  setlist_revision: {
    title: 'Setlist Revision Requested',
    body: 'The setlist for [event] needs revision. Reason: [review notes].',
  },
  setlist_rejected: {
    title: 'Setlist Rejected',
    body: 'The setlist for [event] was not approved. Reason: [review notes].',
  },
  setlist_changed: {
    title: 'Setlist Updated — Re-approval Needed',
    body: 'The setlist for [event] was updated after approval and needs to be reviewed again.',
  },
  announcement: {
    title: 'New Announcement: [announcement title]',
    body: '[Announcement content]',
  },
  comment: {
    title: 'New Comment',
    body: '[Member] commented on “[announcement title]”.',
  },
  mention: {
    title: 'You were mentioned',
    body: '[Member] mentioned you in [conversation].',
  },
  message: {
    title: '[Organization name]',
    body: '[Sender]: [message preview]',
  },
  video: {
    title: 'New Video: [video title]',
    body: '[Video description]',
  },
  leave_request: {
    title: 'New Unavailable Day Request',
    body: '[Member] requested to be unavailable on [date] — [reason].',
  },
  leave_response: {
    title: 'Unavailable Day Approved / Declined',
    body: 'Your unavailable day request for [date] has been approved or declined.',
  },
  swap_request: {
    title: '[Member] wants to swap schedules',
    body: 'They are offering [their assignment] in exchange for [your assignment]. Tap to respond.',
  },
  swap_approved: {
    title: 'Schedule swap approved',
    body: 'Your swap with [member] was approved by leadership.',
  },
  swap_declined: {
    title: 'Schedule swap declined',
    body: 'Your swap with [member] was declined.',
  },
  sub_request: {
    title: 'New substitute request for review',
    body: '[Member] agreed to substitute with [member]. Leadership approval is required.',
  },
  sub_approved: {
    title: 'Substitute request approved',
    body: 'Your substitute request with [member] was approved by leadership.',
  },
  sub_declined: {
    title: 'Substitute request declined',
    body: 'Your substitute request with [member] was declined.',
  },
  role_changed: {
    title: 'Ministry Role Updated',
    body: '[Ministry role] was added or removed on your ServeSync profile.',
  },
  member_joined: {
    title: 'New Team Member',
    body: '[Member] joined your ServeSync organization.',
  },
  birthday: {
    title: 'Birthday Today',
    body: 'Today is [member]’s birthday!',
  },
  discipline_created: {
    title: 'Conduct Record Created',
    body: '[Conduct record] now has status: [status].',
  },
  discipline_updated: {
    title: 'Conduct Record Updated',
    body: '[Conduct record] now has status: [status].',
  },
  push_test: {
    title: 'ServeSync Push Test',
    body: 'This is a test notification used to verify push delivery.',
  },
};

export function getBuiltInNotificationCopy(
  type: string,
  fallbackTitle: string,
  fallbackBody: string,
): NotificationCopy {
  return copy[type] || { title: fallbackTitle, body: fallbackBody };
}
