export interface Profile {
  id: string;
  first_name: string;
  second_name: string;
  middle_name: string;
  last_name: string;
  nickname: string;
  email: string;
  phone: string;
  gender: string;
  birthday: string | null;
  avatar_url: string;
  is_onboarded: boolean;
  ministry_status: 'active' | 'restoration' | 'suspended' | 'inactive';
  leadership_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  is_leadership: boolean;
  sort_order: number;
}

export interface UserRole {
  id: string;
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
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  reviewed_at: string | null;
  approval_notes: string | null;
  is_recurring: boolean;
  recurrence_type: 'weekly' | 'biweekly' | 'monthly' | null;
  leave_type: 'single' | 'range';
  start_date: string | null;
  end_date: string | null;
  profiles?: Profile;
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

export interface EventMessage {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  file_url?: string;
  file_type?: string;
  created_at: string;
  profiles?: Profile;
}

export interface Conversation {
  id: string;
  type: 'personal' | 'group' | 'event';
  name: string;
  event_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  events?: Event;
  conversation_members?: ConversationMember[];
  latest_message?: Message;
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  profiles?: Profile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  file_url?: string;
  file_type?: string;
  created_at: string;
  deleted_at?: string;
  deleted_by?: string;
  is_pinned?: boolean;
  pinned_by?: string;
  pinned_at?: string;
  reply_to?: string;
  profiles?: Profile;
  reply_message?: Message;
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  profiles?: Profile;
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
