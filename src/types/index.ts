export interface Profile {
  id: string;
  org_id: string | null;
  is_org_admin: boolean;
  first_name: string;
  second_name: string;
  middle_name: string;
  last_name: string;
  nickname: string;
  email: string;
  phone: string;
  gender: string;
  birthday: string | null;
  official_join_date: string | null;
  avatar_url: string;
  is_onboarded: boolean;
  ministry_status: 'active' | 'restoration' | 'suspended' | 'inactive';
  leadership_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  created_by: string | null;
  trial_started_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | null;
  billing_status: 'trialing' | 'submitted' | 'active' | 'past_due' | 'suspended' | 'exempt' | null;
  billing_plan: string | null;
  billing_interval: 'monthly' | 'quarterly' | 'annual' | 'custom' | null;
  payment_method: 'manual_gcash' | 'manual_bank_transfer' | 'manual_flexible' | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  billing_grace_ends_at: string | null;
  is_billing_exempt: boolean;
  seats_purchased: number;
  created_at: string;
  updated_at: string;
}

export interface OrganizationInvitation {
  id: string;
  org_id: string;
  email: string;
  role_ids: string[];
  is_admin: boolean;
  invited_by: string | null;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface PlatformOverviewMetrics {
  total_churches: number;
  total_members: number;
  total_org_admins: number;
  active_subscriptions: number;
  trialing_subscriptions: number;
  past_due_subscriptions: number;
  canceled_subscriptions: number;
  pending_invites: number;
  unattached_registrations: number;
}

export interface PlatformOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  seats_purchased: number;
  created_at: string;
  member_count: number;
  org_admin_count: number;
  event_count: number;
  announcement_count: number;
  pending_invite_count: number;
}

export interface PlatformOrganizationDetail {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  seats_purchased: number;
  created_at: string;
}

export interface PlatformOrganizationMember {
  profile_id: string;
  email: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  is_org_admin: boolean;
  is_onboarded: boolean;
  ministry_status: string;
  created_at: string;
}

export interface OrganizationPaymentSubmission {
  id: string;
  org_id: string;
  submitted_by: string;
  plan_code: string;
  amount: number;
  billing_reference: string;
  payer_name: string | null;
  payment_channel: 'gcash' | 'bank_transfer';
  reference_number: string;
  receipt_url: string | null;
  note: string | null;
  status: 'submitted' | 'verified' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformPaymentSubmission {
  id: string;
  org_id: string;
  church_name: string;
  church_slug: string;
  submitted_by: string;
  submitted_by_email: string | null;
  plan_code: string;
  amount: number;
  billing_reference: string;
  payer_name: string | null;
  payment_channel: 'gcash' | 'bank_transfer';
  reference_number: string;
  receipt_url: string | null;
  note: string | null;
  status: 'submitted' | 'verified' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface PlatformRecentRegistration {
  profile_id: string;
  email: string;
  first_name: string;
  created_at: string;
  org_id: string | null;
  org_name: string | null;
  is_org_admin: boolean;
  is_onboarded: boolean;
}

export interface Role {
  id: string;
  name: string;
  is_leadership: boolean;
  sort_order: number;
}

export interface UserRole {
  id: string;
  org_id?: string | null;
  user_id: string;
  role_id: string;
  roles?: Role;
}

export interface Event {
  id: string;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  event_type: string;
  description: string;
  created_by: string;
  confirmation_deadline: string | null;
  proposal_due_date?: string | null;
  linked_event_id?: string | null;
  song_leader_id?: string | null;
  created_at: string;
  profiles?: Profile;
}

export interface EventAssignment {
  id: string;
  event_id: string;
  user_id: string;
  role_id: string;
  status: 'pending' | 'confirmed' | 'declined';
  decline_reason: string;
  confirmed_at: string | null;
  profiles?: Profile;
  roles?: Role;
  events?: Event;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  song_key: string;
  duration: string;
  key_notes: string;
  youtube_url: string;
  lyrics?: string | null;
  chordpro_text?: string | null;
  created_by: string;
  created_at: string;
}

export type ServiceFormat = 'sunday_full' | 'sunday_short' | 'special_event' | 'opening_closing_only' | 'custom';

export interface Setlist {
  id: string;
  event_id: string;
  status: 'draft' | 'pending_review' | 'approved' | 'revision_requested' | 'rejected';
  created_by: string;
  approved_by: string | null;
  approval_notes: string;
  review_note: string | null;
  created_at: string;
  submitted_at: string | null;
  last_edited_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  service_format: ServiceFormat | null;
  flow_score: number | null;
  content_score: number | null;
  checker_summary: string | null;
  last_checker_run_at: string | null;
  events?: Event;
  profiles?: Profile;
  setlist_songs?: SetlistSong[];
}

export interface SetlistSong {
  id: string;
  setlist_id: string;
  song_id: string;
  position: number;
  notes: string;
  song_category: string;
  youtube_url: string;
  performed_key: string;
  section_role: string | null;
  is_manual_entry: boolean;
  songs?: Song;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'high' | 'urgent';
  media_url: string;
  created_by: string;
  created_at: string;
  profiles?: Profile;
  announcement_comments?: AnnouncementComment[];
  announcement_views?: AnnouncementView[];
}

export interface AnnouncementComment {
  id: string;
  announcement_id: string;
  user_id: string;
  content: string;
  reply_to: string | null;
  created_at: string;
  profiles?: Profile;
  reply_comment?: AnnouncementComment;
}

export interface AnnouncementView {
  announcement_id: string;
  user_id: string;
  viewed_at: string;
  profiles?: Profile;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  category: string;
  uploaded_by: string;
  created_at: string;
  profiles?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string>;
  is_read: boolean;
  created_at: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

export interface UserAvailability {
  id: string;
  user_id: string;
  unavailable_date: string | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  approved_by: string | null;
  reviewed_at: string | null;
  approval_notes: string | null;
  is_recurring: boolean;
  recurrence_type: 'weekly' | 'biweekly' | 'monthly' | null;
  leave_type: 'single' | 'range';
  start_date: string | null;
  end_date: string | null;
  target_id?: string | null;
  requester_assignment_id?: string | null;
  target_assignment_id?: string | null;
  request_type?: 'leave' | 'sub' | 'swap';
  target_response_at?: string | null;
  review_note?: string | null;
  profiles?: Profile;
  target?: Profile;
  requester_assignment?: EventAssignment & { events?: Event; roles?: Role };
  target_assignment?: EventAssignment & { events?: Event; roles?: Role };
}

export interface EventAttendance {
  id: string;
  event_id: string;
  user_id: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  checked_in_at: string | null;
  marked_at: string | null;
  marked_by: string | null;
  excused_reason: string | null;
  notes: string | null;
  is_assigned: boolean;
  override_by: string | null;
  override_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DisciplineRecord {
  id: string;
  user_id: string;
  created_by: string;
  source: 'attendance' | 'setlist' | 'manual';
  offense_number: number | null;
  quarter_year: number | null;
  quarter_number: number | null;
  status: 'open' | 'verbal_warning' | 'counselling' | 'suspension' | 'resolved';
  title: string;
  notes: string | null;
  leader_notes: string | null;
  final_decision: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
  created_by_profile?: Profile;
}

export interface UserPreference {
  id: string;
  user_id: string;
  role_id: string;
  skill_level: number;
  preference_level: number;
  roles?: Role;
}

export interface AnnouncementReaction {
  id: string;
  announcement_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  profiles?: Profile;
}

export interface AnnouncementPin {
  id: string;
  announcement_id: string;
  pinned_by: string;
  pinned_at: string;
}

export interface SwapRequest {
  id: string;
  requester_id: string;
  target_id: string;
  requester_assignment_id: string;
  target_assignment_id: string;
  reason: string;
  status: 'pending_target' | 'pending_leadership' | 'approved' | 'declined_by_target' | 'declined_by_leadership' | 'cancelled';
  target_response_at: string | null;
  leadership_response_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  requester?: Profile;
  target?: Profile;
  requester_assignment?: EventAssignment & { events?: Event; roles?: Role };
  target_assignment?: EventAssignment & { events?: Event; roles?: Role };
}

export interface SetlistCheckerSong {
  id: string;
  song_id: string | null;
  title: string;
  artist: string;
  song_key: string;
  category: string;
  duration: string;
  youtube_url: string;
  position: number;
}

export interface SetlistCheckerScorePerSong {
  song_id: string;
  title: string;
  score: number;
  category_fit: 'good' | 'ok' | 'poor';
  theological_flags: string[];
  notes: string;
}

export interface SetlistCheckerResult {
  id: string;
  setlist_id: string | null;
  session_id: string | null;
  created_by: string;
  language_mode: 'english' | 'tagalog_english';
  score_overall: number | null;
  score_per_song: SetlistCheckerScorePerSong[];
  theological_flags: string[];
  sequence_suggestions: string | null;
  category_fit_notes: string | null;
  full_analysis: string | null;
  suggested_order: SetlistCheckerSong[];
  status: 'pending' | 'analyzed' | 'approved' | 'revision' | 'rejected';
  leader_decision: 'approve' | 'revision' | 'reject' | null;
  leader_notes: string | null;
  analyzed_at: string | null;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
  updated_at: string;
  created_by_profile?: Profile;
  decided_by_profile?: Profile;
}

export interface SetlistCheckerSession {
  id: string;
  created_by: string;
  name: string | null;
  songs_json: SetlistCheckerSong[];
  result_json: SetlistCheckerResult | null;
  language_mode: 'english' | 'tagalog_english';
  created_at: string;
  updated_at: string;
}

// ── Setlist Check Report (theological analysis) ──────────────────────────────

export interface SlotCheck {
  title: string;
  artist: string;
  slot: string;
  fits: boolean;
  reason: string;
  action: 'APPROVED' | 'APPROVED_WITH_CAUTION' | 'NEEDS_LEADER_REVIEW' | 'REJECTED';
  priorityTier: string;
}

export interface SetlistCheckReport {
  verdict: 'APPROVE' | 'REVISE' | 'REJECT';
  rating: number;
  verdictExplanation: string;
  flowCheck: {
    ok: boolean;
    issues: string[];
    actsSummary: {
      act: string;
      purpose: string;
      songTitles: string[];
    }[];
  };
  slotFitCheck: SlotCheck[];
  suggestedFlowCorrection?: {
    orderedSongs: { title: string; slot: string }[];
    fixes: string[];
  };
  themeAlignment: {
    theme: string;
    skipped?: boolean;
    summary?: string;
    strengths: { title: string; reason: string }[];
    mismatches: { title: string; reason: string }[];
  };
  gospelCenteredness: {
    checks: { question: string; passed: boolean; explanation: string }[];
    allPassed: boolean;
  };
  theologicalFlags: {
    songTitle: string;
    lyricExcerpt: string;
    flagType: string;
    concern: string;
    recommendation: string;
  }[];
  fiveQuestionTest: {
    title: string;
    artist: string;
    slot: string;
    q1: { result: 'Pass' | 'Needs Revision' | 'Fail'; reason: string };
    q2: { result: 'Pass' | 'Needs Revision' | 'Fail'; reason: string };
    q3: { result: 'Pass' | 'Needs Revision' | 'Fail'; reason: string };
    q4: { result: 'Pass' | 'Needs Revision' | 'Fail'; reason: string };
    q5: { result: 'Pass' | 'Needs Revision' | 'Fail'; reason: string };
    passedQuestions: number;
    flaggedQuestions: number;
    decision: string;
    leaderNote: string;
  }[];
  actionPlan: string[];
  discordText: string;
  analyzedAt: string;
  language: string;
  songsWithLyrics: {
    title: string;
    artist: string;
    slot: string;
    lyricsSource: 'provided' | 'fetched' | 'unavailable';
  }[];
}
