import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isAfter, parseISO, startOfToday, differenceInDays } from 'date-fns';
import { Calendar, CheckCircle, Clock, Music, ChevronRight, AlertCircle, Megaphone, Image as ImageIcon, UserX, Trash2, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DashboardSkeleton } from '../components/LoadingSpinner';
import { Avatar } from '../components/Avatar';
import { formatTime12Hour } from '../lib/timeFormat';
import { ReleaseNotesModal } from '../components/ReleaseNotesModal';
import { Modal } from '../components/Modal';
import type { Event, EventAssignment, Setlist, Announcement, UserAvailability } from '../types';

const verses = [
  { text: 'Shout with joy to the Lord, all the earth!', ref: 'Psalm 100:1 NLT' },
  { text: 'Sing a new song of praise to him; play skillfully on the harp, and sing with joy.', ref: 'Psalm 33:3 NLT' },
  { text: 'Let everything that breathes sing praises to the Lord! Praise the Lord!', ref: 'Psalm 150:6 NLT' },
  { text: 'Singing psalms and hymns and spiritual songs among yourselves, and making music to the Lord in your hearts.', ref: 'Ephesians 5:19 NLT' },
  { text: 'I will sing to the Lord as long as I live. I will praise my God to my last breath!', ref: 'Psalm 104:33 NLT' },
  { text: 'Come, let us sing to the Lord! Let us shout joyfully to the Rock of our salvation.', ref: 'Psalm 95:1 NLT' },
  { text: 'Worship the Lord with gladness. Come before him, singing with joy.', ref: 'Psalm 100:2 NLT' },
];

function staggerStyle(index: number, base = 60): React.CSSProperties {
  return {
    animationDelay: `${base + index * 55}ms`,
    animationFillMode: 'both',
  };
}

function DateBlock({ date, color = 'brand' }: { date: string | null; color?: 'brand' | 'orange' | 'amber' }) {
  if (!date) return <div className="w-11 h-12 rounded-xl shrink-0 bg-gray-100 dark:bg-white/[0.05]" />;
  const parsed = parseISO(date);
  const colors = {
    brand: 'bg-brand-600 text-white',
    orange: 'bg-orange-500 text-white',
    amber: 'bg-amber-500 text-white',
  };
  return (
    <div
      className={`flex flex-col items-center justify-center h-12 w-12 rounded-xl shrink-0 ${colors[color]}`}
      style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }}
    >
      <span className="text-[9px] font-black leading-none uppercase tracking-widest opacity-75">
        {format(parsed, 'MMM')}
      </span>
      <span className="text-[21px] font-black leading-none mt-0.5">
        {format(parsed, 'd')}
      </span>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  count,
  countVariant = 'gray',
  onViewAll,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  countVariant?: 'gray' | 'green' | 'yellow' | 'orange' | 'red';
  onViewAll?: () => void;
}) {
  const countBadge: Record<string, string> = {
    gray: 'badge-gray',
    green: 'badge-green',
    yellow: 'badge-yellow',
    orange: 'badge-orange',
    red: 'badge-red',
  };
  return (
    <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-black/[0.04] dark:border-white/[0.05]">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gray-100 dark:bg-white/[0.07]">
          {icon}
        </div>
        <span className="text-[13px] font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.015em' }}>
          {title}
        </span>
        {count !== undefined && (
          <span className={countBadge[countVariant]}>{count}</span>
        )}
      </div>
      {onViewAll && (
        <button
          onClick={onViewAll}
          className="flex items-center gap-0.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
        >
          View all
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function ListRow({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-3.5 px-4 sm:px-5 py-3.5 w-full text-left transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.03] active:bg-black/[0.04] dark:active:bg-white/[0.05]"
      >
        {children}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-3.5 px-4 sm:px-5 py-3.5 w-full">
      {children}
    </div>
  );
}

export function Dashboard() {
  const { user, profile, isLeader, isProductionDirector } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [myAssignments, setMyAssignments] = useState<EventAssignment[]>([]);
  const [pendingSetlists, setPendingSetlists] = useState<Setlist[]>([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([]);
  const [unavailableMembers, setUnavailableMembers] = useState<UserAvailability[]>([]);
  const [stats, setStats] = useState({ total: 0, confirmed: 0, pending: 0 });
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [selectedUnavailability, setSelectedUnavailability] = useState<UserAvailability | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const todayVerse = verses[new Date().getDay() % verses.length];

  useEffect(() => {
    if (!user) return;
    const today = startOfToday().toISOString().split('T')[0];

    const load = async () => {
      const [eventsRes, assignRes, setlistsRes, announcementsRes, unavailableRes] = await Promise.all([
        supabase.from('events').select('*').gte('event_date', today).order('event_date').limit(5),
        supabase.from('event_assignments').select('*, events(*), roles(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
        isLeader
          ? supabase.from('setlists').select('*, events(title, event_date)').eq('status', 'pending_review').order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase.from('announcements').select('*, profiles!announcements_created_by_fkey(first_name, last_name)').order('created_at', { ascending: false }).limit(3),
        supabase.from('user_availability').select('*, profiles!user_availability_user_id_fkey(first_name, last_name, nickname, avatar_url)').eq('status', 'approved').or(`unavailable_date.gte.${today},end_date.gte.${today}`).order('created_at', { ascending: true }),
      ]);

      setUpcomingEvents(eventsRes.data || []);

      const assignments = (assignRes.data || []) as EventAssignment[];
      const upcomingAssignments = assignments.filter(a => a.events && isAfter(parseISO(a.events.event_date), startOfToday()));
      upcomingAssignments.sort((a, b) => parseISO(a.events!.event_date).getTime() - parseISO(b.events!.event_date).getTime());
      setMyAssignments(upcomingAssignments);
      setPendingSetlists((setlistsRes.data || []) as Setlist[]);
      setRecentAnnouncements((announcementsRes.data || []) as Announcement[]);
      setUnavailableMembers((unavailableRes.data || []) as UserAvailability[]);

      const upcoming = assignments.filter(a => a.events && isAfter(parseISO(a.events.event_date), startOfToday()));
      setStats({
        total: upcoming.length,
        confirmed: upcoming.filter(a => a.status === 'confirmed').length,
        pending: upcoming.filter(a => a.status === 'pending').length,
      });

      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('release_notes_last_viewed_at')
        .eq('user_id', user.id)
        .maybeSingle();

      const lastViewed = prefs?.release_notes_last_viewed_at;
      const shouldShow = !lastViewed || differenceInDays(new Date(), new Date(lastViewed)) >= 7;
      setShowReleaseNotes(shouldShow);
      setLoading(false);
    };

    load();
  }, [user, isLeader]);

  const handleCloseReleaseNotes = async () => {
    setShowReleaseNotes(false);
    if (!user) return;
    await supabase
      .from('user_preferences')
      .upsert({ user_id: user.id, release_notes_last_viewed_at: new Date().toISOString() }, { onConflict: 'user_id' });
  };
  const handleDeleteClick = () => setShowDeleteConfirm(true);

  const handleConfirmDelete = async () => {
    if (!selectedUnavailability) return;
    const { error } = await supabase.from('user_availability').delete().eq('id', selectedUnavailability.id);
    if (!error) {
      setUnavailableMembers(prev => prev.filter(u => u.id !== selectedUnavailability.id));
      setSelectedUnavailability(null);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) return <div className="page-container"><DashboardSkeleton /></div>;

  const displayName = profile?.nickname || profile?.first_name || 'there';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return 'Good night';
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const nextEvent = upcomingEvents[0];
  const daysUntilNext = nextEvent
    ? differenceInDays(parseISO(nextEvent.event_date), startOfToday())
    : null;
  const nextAssignment = myAssignments[0];

  const hasLeaderAlerts = isLeader && (pendingSetlists.length > 0 || unavailableMembers.length > 0);
  const hasActionRequired = isLeader && pendingSetlists.length > 0;
  const hasTeamUpdates = isLeader && unavailableMembers.length > 0;

  return (
    <div className="page-container page-bottom-pad">
      <ReleaseNotesModal open={showReleaseNotes} onClose={handleCloseReleaseNotes} />

      <div className="pt-5 sm:pt-7 pb-4">

        {/* ── Hero Header ────────────────────────────────────── */}
        <div className="px-4 sm:px-5 lg:px-6 mb-5 animate-fade-in" style={{ animationFillMode: 'both' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p
                className="text-[11px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-[0.1em] mb-1.5"
              >
                {getGreeting()}
              </p>
              <h1
                className="text-[2rem] sm:text-[2.25rem] font-black text-gray-900 dark:text-white leading-[1.05]"
                style={{ letterSpacing: '-0.035em' }}
              >
                {displayName}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-snug">
                <span className="font-medium text-gray-600 dark:text-gray-300">
                  {format(new Date(), 'EEEE, MMMM d')}
                </span>
                {daysUntilNext !== null && (
                  <>
                    <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
                    <span>
                      {daysUntilNext === 0 ? 'Service is today' :
                       daysUntilNext === 1 ? 'Next service tomorrow' :
                       `Next service in ${daysUntilNext} days`}
                    </span>
                  </>
                )}
              </p>
            </div>
            <button
              onClick={() => navigate('/profile')}
              className="shrink-0 mt-0.5 relative group"
              aria-label="Go to profile"
            >
              <Avatar
                src={profile?.avatar_url}
                firstName={profile?.first_name || '?'}
                lastName={profile?.last_name}
                size="lg"
                className="ring-[3px] ring-white dark:ring-[#1c1b1e] ring-offset-2 ring-offset-[#f5f5f7] dark:ring-offset-[#0d0d0f] transition-transform duration-200 group-hover:scale-[1.06]"
              />
              {stats.pending > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 bg-amber-500 rounded-full border-2 border-[#f5f5f7] dark:border-[#0d0d0f]"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>

          {/* Quick stat strip */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { label: 'Upcoming', value: stats.total, color: 'text-gray-900 dark:text-white' },
              { label: 'Confirmed', value: stats.confirmed, color: 'text-brand-600 dark:text-brand-400' },
              { label: 'Pending', value: stats.pending, color: stats.pending > 0 ? 'text-amber-500' : 'text-gray-900 dark:text-white' },
            ].map(stat => (
              <button
                key={stat.label}
                onClick={() => navigate('/my-assignments')}
                className="flex flex-col items-start gap-1 px-3 py-3 rounded-2xl bg-white dark:bg-[#1c1b1e] ring-1 ring-black/[0.06] dark:ring-white/[0.07] transition-all hover:ring-black/[0.1] dark:hover:ring-white/[0.12] hover:-translate-y-px active:scale-[0.97]"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <span className={`text-[24px] font-black leading-none tabular-nums ${stat.color}`} style={{ letterSpacing: '-0.04em' }}>
                  {stat.value}
                </span>
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.07em] leading-none">
                  {stat.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Today's Verse ───────────────────────────────────── */}
        <div className="px-4 sm:px-5 lg:px-6 mb-5 animate-slide-up" style={staggerStyle(0)}>
          <div
            className="relative overflow-hidden rounded-2xl px-5 py-5"
            style={{
              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 55%, #166534 100%)',
              boxShadow: '0 4px 20px rgba(22,163,74,0.22), 0 1px 4px rgba(22,163,74,0.12)',
            }}
          >
            <div
              className="absolute -top-12 -right-12 h-40 w-40 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)' }}
            />
            <div
              className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)' }}
            />
            <div className="relative">
              <p className="text-[9px] font-black text-white/50 uppercase tracking-[0.18em] mb-2.5">
                Verse of the Day
              </p>
              <p
                className="text-[15px] font-semibold text-white leading-[1.65] italic mb-3"
                style={{ letterSpacing: '-0.005em' }}
              >
                &ldquo;{todayVerse.text}&rdquo;
              </p>
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-white/20" />
                <p className="text-[11px] font-bold text-white/60 tracking-wide shrink-0">
                  {todayVerse.ref}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Leader Action Alerts ────────────────────────────── */}
        {hasActionRequired && (
          <div className="px-4 sm:px-5 lg:px-6 mb-5 animate-slide-up" style={staggerStyle(1)}>
            <p className="section-label mb-2.5">Action Required</p>
            <div className="space-y-2">
              <button
                onClick={() => navigate(`/events/${pendingSetlists[0].event_id}`)}
                className="w-full flex items-center gap-3.5 p-4 rounded-2xl text-left ring-1 ring-amber-200 dark:ring-amber-800/50 bg-amber-50 dark:bg-amber-950/25 hover:bg-amber-100/80 dark:hover:bg-amber-950/40 transition-colors active:scale-[0.99]"
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 shrink-0">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-amber-900 dark:text-amber-100 leading-tight" style={{ letterSpacing: '-0.01em' }}>
                    {pendingSetlists.length} setlist{pendingSetlists.length > 1 ? 's' : ''} awaiting review
                  </p>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5 truncate">
                    {pendingSetlists[0].events?.title}
                    {pendingSetlists[0].events?.event_date && ` · ${format(parseISO(pendingSetlists[0].events.event_date), 'MMM d')}`}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* ── Team Availability Update ─────────────────────────── */}
        {hasTeamUpdates && (() => {
          const uniqueMembers = [...new Map(unavailableMembers.map(u => [u.user_id, u])).values()];
          const memberCount = uniqueMembers.length;
          const firstName = uniqueMembers[0].profiles?.first_name;
          const lastName = uniqueMembers[0].profiles?.last_name;
          return (
            <div className="px-4 sm:px-5 lg:px-6 mb-5 animate-slide-up" style={staggerStyle(hasActionRequired ? 2 : 1)}>
              <p className="section-label mb-2.5">Team Availability</p>
              <button
                onClick={() => navigate('/unavailable-members')}
                className="w-full flex items-center gap-3.5 p-4 rounded-2xl text-left ring-1 ring-orange-200 dark:ring-orange-800/50 bg-orange-50 dark:bg-orange-950/25 hover:bg-orange-100/80 dark:hover:bg-orange-950/40 transition-colors active:scale-[0.99]"
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-orange-500/15 dark:bg-orange-500/20 shrink-0">
                  <UserX className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-orange-900 dark:text-orange-100 leading-tight" style={{ letterSpacing: '-0.01em' }}>
                    {memberCount} member{memberCount > 1 ? 's' : ''} with approved leave
                  </p>
                  <p className="text-[11px] text-orange-700/80 dark:text-orange-400/80 mt-0.5">
                    {firstName} {lastName}
                    {memberCount > 1 && ` + ${memberCount - 1} more`}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-orange-500 dark:text-orange-400 shrink-0" />
              </button>
            </div>
          );
        })()}

        {/* ── Unavailable Members (non-leader) ───────────────── */}
        {!isLeader && unavailableMembers.length > 0 && (() => {
          const uniqueMemberCount = new Set(unavailableMembers.map(u => u.user_id)).size;
          return (
          <div className="px-4 sm:px-5 lg:px-6 mb-5 animate-slide-up" style={staggerStyle(1)}>
            <div className="card overflow-hidden">
              <SectionHeader
                icon={<UserX className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400" />}
                title="Unavailable Members"
                count={uniqueMemberCount}
                countVariant="orange"
                onViewAll={unavailableMembers.length > 2 ? () => navigate('/unavailable-members') : undefined}
              />
              <div className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
                {unavailableMembers.slice(0, 2).map(ua => (
                  <ListRow key={ua.id} onClick={() => setSelectedUnavailability(ua)}>
                    <DateBlock date={ua.leave_type === 'range' ? ua.start_date : ua.unavailable_date} color="orange" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                        {ua.profiles?.first_name} {ua.profiles?.last_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {ua.reason || 'No reason provided'}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 shrink-0" />
                  </ListRow>
                ))}
              </div>
            </div>
          </div>
        );
        })()}

        {/* ── Next Service Spotlight ──────────────────────────── */}
        {nextAssignment && nextAssignment.events && (
          <div className="px-4 sm:px-5 lg:px-6 mb-5 animate-slide-up" style={staggerStyle(2)}>
            <button
              onClick={() => navigate(`/events/${nextAssignment.event_id}`)}
              className="w-full text-left group"
            >
              <div className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 transition-all duration-150 group-hover:-translate-y-px active:scale-[0.99] ${
                nextAssignment.status === 'confirmed'
                  ? 'bg-gradient-to-br from-brand-600 to-brand-700 dark:from-brand-700 dark:to-brand-800 shadow-lg shadow-brand-500/20 dark:shadow-brand-900/40 group-hover:shadow-xl group-hover:shadow-brand-500/25'
                  : 'bg-gradient-to-br from-amber-500 to-orange-500 dark:from-amber-600 dark:to-orange-600 shadow-lg shadow-amber-500/25 dark:shadow-amber-900/40 group-hover:shadow-xl group-hover:shadow-amber-500/30'
              }`}>
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)' }} />
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Your Next Service</p>
                  {nextAssignment.status === 'pending' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/25 text-white animate-pulse">
                      <Clock className="h-2.5 w-2.5" /> Action Required
                    </span>
                  )}
                </div>
                <div className="flex items-start gap-4">
                  <div className="shrink-0 flex flex-col items-center justify-center bg-white/15 rounded-xl w-12 h-12 backdrop-blur-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 leading-none">
                      {format(parseISO(nextAssignment.events.event_date), 'MMM')}
                    </span>
                    <span className="text-xl font-black text-white leading-none mt-0.5">
                      {format(parseISO(nextAssignment.events.event_date), 'd')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p
                        className="text-[15px] font-bold text-white leading-tight truncate"
                        style={{ letterSpacing: '-0.02em' }}
                      >
                        {nextAssignment.events.title}
                      </p>
                      <ChevronRight className="h-4 w-4 text-white/50 shrink-0 mt-0.5" />
                    </div>
                    <p className={`text-xs mb-2.5 ${nextAssignment.status === 'confirmed' ? 'text-brand-100/70' : 'text-amber-100/80'}`}>
                      {format(parseISO(nextAssignment.events.event_date), 'EEEE, MMMM d')}
                      {nextAssignment.events.start_time && ` · ${formatTime12Hour(nextAssignment.events.start_time)}`}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {nextAssignment.roles?.name && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/20 text-white backdrop-blur-sm">
                          {nextAssignment.roles.name}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur-sm ${
                        nextAssignment.status === 'confirmed' ? 'bg-emerald-400/25 text-emerald-100' :
                        nextAssignment.status === 'declined' ? 'bg-red-400/25 text-red-100' : 'bg-white/25 text-white'
                      }`}>
                        {nextAssignment.status === 'confirmed' ? (
                          <><CheckCircle className="h-2.5 w-2.5" /> Confirmed</>
                        ) : nextAssignment.status === 'pending' ? (
                          <><Clock className="h-2.5 w-2.5" /> Pending</>
                        ) : nextAssignment.status}
                      </span>
                      {nextAssignment.status === 'pending' && (
                        <span className="text-[11px] font-bold text-white">
                          Please confirm your schedule!
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* ── Planning grid (Events + Assignments) ───────────── */}
        <div className="px-4 sm:px-5 lg:px-6 mb-5">
          <div className="grid gap-4 lg:grid-cols-2">

            <div className="card overflow-hidden animate-slide-up" style={staggerStyle(3)}>
              <SectionHeader
                icon={<Calendar className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />}
                title="Upcoming Events"
                count={upcomingEvents.length}
                onViewAll={() => navigate('/events')}
              />
              {upcomingEvents.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-gray-400">No upcoming events</p>
                </div>
              ) : (
                <div className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
                  {upcomingEvents.slice(0, 3).map(event => (
                    <ListRow key={event.id} onClick={() => navigate(`/events/${event.id}`)}>
                      <DateBlock date={event.event_date} color="brand" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">{event.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {event.event_type}
                          {event.start_time && ` · ${formatTime12Hour(event.start_time)}`}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 shrink-0" />
                    </ListRow>
                  ))}
                </div>
              )}
            </div>

            <div className="card overflow-hidden animate-slide-up" style={staggerStyle(4)}>
              <SectionHeader
                icon={<Music className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />}
                title="My Assignments"
                count={stats.total}
                onViewAll={() => navigate('/my-assignments')}
              />
              {myAssignments.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-gray-400">No current assignments</p>
                </div>
              ) : (
                <div className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
                  {myAssignments.slice(0, 3).map(a => (
                    <ListRow key={a.id} onClick={() => navigate(`/events/${a.event_id}`)}>
                      {a.events?.event_date && (
                        <DateBlock date={a.events.event_date} color="brand" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">{a.events?.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {a.roles?.name}
                          {a.events?.start_time && ` · ${formatTime12Hour(a.events.start_time)}`}
                        </p>
                      </div>
                      <span className={`badge shrink-0 ${
                        a.status === 'confirmed' ? 'badge-green' :
                        a.status === 'declined' ? 'badge-red' : 'badge-yellow'
                      }`}>
                        {a.status === 'confirmed' ? <CheckCircle className="h-2.5 w-2.5" /> :
                         a.status === 'pending' ? <Clock className="h-2.5 w-2.5" /> :
                         a.status}
                      </span>
                    </ListRow>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Announcements ───────────────────────────────────── */}
        {recentAnnouncements.length > 0 && (
          <div className="px-4 sm:px-5 lg:px-6 mb-5 animate-slide-up" style={staggerStyle(5)}>
            <div className="card overflow-hidden">
              <SectionHeader
                icon={<Megaphone className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />}
                title="Announcements"
                onViewAll={() => navigate('/announcements')}
              />
              <div className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
                {recentAnnouncements.map(a => {
                  const blocks = (a as Announcement & { content_blocks?: { type: string; content: string }[] }).content_blocks;
                  const hasPhotos = blocks?.some(b => b.type === 'image');
                  const previewText = blocks && blocks.length > 0
                    ? blocks.find(b => b.type === 'text')?.content || ''
                    : a.content;

                  return (
                    <ListRow key={a.id} onClick={() => navigate(`/announcements/${a.id}`)}>
                      <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gray-100 dark:bg-white/[0.06] shrink-0">
                        <Megaphone className="h-[17px] w-[17px] text-gray-400 dark:text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">{a.title}</p>
                          {a.priority === 'urgent' && <span className="badge-red shrink-0">Urgent</span>}
                          {hasPhotos && <ImageIcon className="h-3 w-3 text-gray-400 shrink-0" />}
                        </div>
                        {previewText && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{previewText}</p>
                        )}
                        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 mt-1">
                          {a.profiles?.first_name} {a.profiles?.last_name}
                          {' · '}{format(parseISO(a.created_at), 'MMM d')}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 shrink-0" />
                    </ListRow>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Unavailability detail modal ────────────────────── */}
      <Modal
        open={!!selectedUnavailability}
        onClose={() => setSelectedUnavailability(null)}
        title="Unavailability Details"
      >
        {selectedUnavailability && (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Team Member</label>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {selectedUnavailability.profiles?.first_name} {selectedUnavailability.profiles?.last_name}
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Date</label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {selectedUnavailability.leave_type === 'range' && selectedUnavailability.start_date && selectedUnavailability.end_date
                    ? `${format(parseISO(selectedUnavailability.start_date), 'MMM d')} – ${format(parseISO(selectedUnavailability.end_date), 'MMMM d, yyyy')}`
                    : selectedUnavailability.unavailable_date
                      ? format(parseISO(selectedUnavailability.unavailable_date), 'EEEE, MMMM d, yyyy')
                      : '—'}
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Reason</label>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedUnavailability.reason || 'No reason provided'}
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
                <span className="badge-green">{selectedUnavailability.status}</span>
              </div>
              {selectedUnavailability.reviewed_at && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Reviewed At</label>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {format(parseISO(selectedUnavailability.reviewed_at), 'MMMM d, yyyy h:mm a')}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              {isProductionDirector ? (
                <>
                  <button onClick={() => setSelectedUnavailability(null)} className="btn-secondary">Close</button>
                  <button onClick={handleDeleteClick} className="btn-danger flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </>
              ) : (
                <button onClick={() => setSelectedUnavailability(null)} className="btn-secondary">Close</button>
              )}
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Request"
        size="sm"
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Are you sure you want to delete this unavailability request? This action cannot be undone.
        </p>
        <div className="mt-6 flex gap-3 justify-end">
          <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleConfirmDelete} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
