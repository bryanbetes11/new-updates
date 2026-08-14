import { useEffect, useState } from 'react';
import { format, parseISO, startOfToday, isBefore } from 'date-fns';
import { AlertTriangle, UserX, ChevronRight, Trash2, Calendar, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { PageLoader } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import type { Profile, UserAvailability } from '../types';

type TeamMemberSummary = Pick<Profile, 'id' | 'first_name' | 'last_name' | 'avatar_url'>;

export function UnavailableMembers() {
  const { user, isProductionDirector } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [unavailableMembers, setUnavailableMembers] = useState<UserAvailability[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberSummary[]>([]);
  const [selectedUnavailability, setSelectedUnavailability] = useState<UserAvailability | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadUnavailableMembers = async () => {
    setLoadError(null);
    const [availabilityResult, membersResult, inclusionResult] = await Promise.all([
      supabase
        .from('user_availability')
        .select('*, profiles!user_availability_user_id_fkey(first_name, last_name, nickname, avatar_url)')
        .eq('status', 'approved')
        .order('created_at', { ascending: true }),
      supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .eq('is_onboarded', true)
        .eq('ministry_status', 'active')
        .order('first_name')
        .order('last_name'),
      supabase.from('organization_member_settings').select('user_id, include_in_assignments'),
    ]);
    if (availabilityResult.error || membersResult.error) {
      setLoadError('We could not load team availability. Check your connection and try again.');
    } else {
      setUnavailableMembers((availabilityResult.data || []) as UserAvailability[]);
      const excluded = new Set((inclusionResult.data || []).filter(row => !row.include_in_assignments).map(row => row.user_id));
      setTeamMembers(((membersResult.data || []) as TeamMemberSummary[]).filter(member => !excluded.has(member.id)));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    loadUnavailableMembers();
  }, [user]);

  const handleDelete = async () => {
    if (!selectedUnavailability) return;
    setDeleting(true);
    const { error } = await supabase.from('user_availability').delete().eq('id', selectedUnavailability.id);
    setDeleting(false);
    if (error) {
      toast('error', 'Failed to delete unavailable request');
      return;
    }
    toast('success', 'Unavailable request deleted');
    setShowDelete(false);
    setSelectedUnavailability(null);
    loadUnavailableMembers();
  };

  if (loading) return <PageLoader />;

  const today = startOfToday();
  const getRepresentativeDate = (ua: UserAvailability) =>
    ua.leave_type === 'range' ? ua.start_date : ua.unavailable_date;

  const formatLeaveDate = (ua: UserAvailability): string => {
    if (ua.leave_type === 'range' && ua.start_date && ua.end_date) {
      const s = parseISO(ua.start_date);
      const e = parseISO(ua.end_date);
      if (format(s, 'MMM yyyy') === format(e, 'MMM yyyy')) {
        return `${format(s, 'MMM d')}–${format(e, 'd, yyyy')}`;
      }
      return `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`;
    }
    if (ua.unavailable_date) return format(parseISO(ua.unavailable_date), 'MMM d, yyyy');
    return '—';
  };
  const upcoming = unavailableMembers.filter(ua => {
    const d = getRepresentativeDate(ua);
    return d ? !isBefore(parseISO(d), today) : false;
  });
  const past = unavailableMembers.filter(ua => {
    const d = getRepresentativeDate(ua);
    return d ? isBefore(parseISO(d), today) : false;
  });
  const uniqueUpcomingCount = new Set(upcoming.map(u => u.user_id)).size;
  const leaveCountByMember = unavailableMembers.reduce<Record<string, number>>((counts, leave) => {
    counts[leave.user_id] = (counts[leave.user_id] || 0) + 1;
    return counts;
  }, {});

  const DateChip = ({ date, dim = false }: { date: string | null; dim?: boolean }) => {
    if (!date) return (
      <div className={`flex flex-col items-center justify-center w-11 h-12 rounded-xl shrink-0 ${dim ? 'bg-gray-100 dark:bg-white/[0.05]' : 'bg-orange-500'}`}
        style={dim ? {} : { boxShadow: '0 2px 8px rgba(249,115,22,0.3)' }}>
        <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${dim ? 'text-gray-400 dark:text-gray-500' : 'text-orange-100'}`}>—</span>
      </div>
    );
    const parsed = parseISO(date);
    return (
      <div className={`flex flex-col items-center justify-center w-11 h-12 rounded-xl shrink-0 ${dim ? 'bg-gray-100 dark:bg-white/[0.05]' : 'bg-orange-500'}`}
        style={dim ? {} : { boxShadow: '0 2px 8px rgba(249,115,22,0.3)' }}>
        <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${dim ? 'text-gray-400 dark:text-gray-500' : 'text-orange-100'}`}>
          {format(parsed, 'MMM')}
        </span>
        <span className={`text-[19px] font-black leading-none mt-0.5 ${dim ? 'text-gray-400 dark:text-gray-500' : 'text-white'}`}>
          {format(parsed, 'd')}
        </span>
      </div>
    );
  };

  const MemberRow = ({ ua, dim = false }: { ua: UserAvailability; dim?: boolean }) => (
    <button
      type="button"
      onClick={() => setSelectedUnavailability(ua)}
      className={`flex items-center gap-3.5 px-4 sm:px-5 py-3.5 w-full text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03] active:bg-black/[0.04] ${dim ? 'opacity-55' : ''}`}
    >
      <DateChip date={getRepresentativeDate(ua)} dim={dim} />
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar
          src={ua.profiles?.avatar_url}
          firstName={ua.profiles?.first_name || '?'}
          lastName={ua.profiles?.last_name}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-gray-900 dark:text-white leading-tight truncate">
            {ua.profiles?.first_name} {ua.profiles?.last_name}
          </p>
          <p className="text-[11.5px] font-medium text-orange-600 dark:text-orange-400 mt-0.5 leading-snug truncate">
            {formatLeaveDate(ua)}
          </p>
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5 truncate leading-snug">
            {ua.reason || 'No reason provided'}
          </p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 shrink-0" />
    </button>
  );

  return (
    <div className="profile-page-scroll page-container page-bottom-pad">
      <div className="px-4 sm:px-5 lg:px-6 pt-5 sm:pt-7 pb-4 space-y-5">

        <div className="animate-fade-in" style={{ animationFillMode: 'both' }}>
          <p className="text-[11px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-[0.1em] mb-1">
            Team Overview
          </p>
          <h1
            className="text-[2rem] font-black text-gray-900 dark:text-white leading-[1.05]"
          >
            Unavailable Members
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            Approved leave requests from your team
          </p>
        </div>

        <div className="card overflow-hidden animate-slide-up" style={{ animationFillMode: 'both' }}>
          <div className="flex items-center gap-2.5 border-b border-black/[0.04] px-4 py-3.5 dark:border-white/[0.05] sm:px-5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-500/15">
              <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="flex-1 text-[13px] font-bold text-gray-900 dark:text-white">All Members</span>
            <span className="badge-gray">{teamMembers.length}</span>
          </div>
          <div className="grid divide-y divide-black/[0.04] dark:divide-white/[0.05] md:grid-cols-2 md:divide-x md:[&>*:nth-child(2)]:border-t-0">
            {teamMembers.map(member => {
              const leaveCount = leaveCountByMember[member.id] || 0;
              return (
                <div key={member.id} className="flex min-w-0 items-center gap-3 px-4 py-3 sm:px-5">
                  <Avatar src={member.avatar_url} firstName={member.first_name} lastName={member.last_name} size="sm" />
                  <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-gray-900 dark:text-white">
                    {member.first_name} {member.last_name}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${leaveCount > 0 ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300' : 'bg-black/[0.04] text-gray-500 dark:bg-white/[0.06] dark:text-white/40'}`}
                    aria-label={`${leaveCount} total approved leave records for ${member.first_name} ${member.last_name}`}
                  >
                    {leaveCount} {leaveCount === 1 ? 'leave' : 'leaves'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="card overflow-hidden animate-slide-up"
          style={{ animationDelay: '60ms', animationFillMode: 'both' }}
        >
          <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3.5 border-b border-black/[0.04] dark:border-white/[0.05]">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-orange-100 dark:bg-orange-500/15 shrink-0">
              <UserX className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
            </div>
            <span className="text-[13px] font-bold text-gray-900 dark:text-white flex-1">
              Upcoming
            </span>
            <span className="badge-orange">
              {uniqueUpcomingCount} member{uniqueUpcomingCount !== 1 ? 's' : ''}
            </span>
          </div>

          {loadError ? (
            <div role="alert" className="px-5 py-8">
              <EmptyState
                icon={<AlertTriangle className="h-7 w-7" />}
                title="Unable to load availability"
                description={loadError}
                action={
                  <button type="button" onClick={() => { setLoading(true); loadUnavailableMembers(); }} className="btn-primary min-h-11">
                    Try again
                  </button>
                }
              />
            </div>
          ) : upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gray-100 dark:bg-white/[0.06] mb-3">
                <UserX className="h-6 w-6 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No upcoming unavailabilities</p>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
              {upcoming.map(ua => <MemberRow key={ua.id} ua={ua} />)}
            </div>
          )}
        </div>

        {!loadError && past.length > 0 && (
          <div
            className="card overflow-hidden animate-slide-up"
            style={{ animationDelay: '120ms', animationFillMode: 'both' }}
          >
            <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3.5 border-b border-black/[0.04] dark:border-white/[0.05]">
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gray-100 dark:bg-white/[0.07] shrink-0">
                <Calendar className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
              </div>
              <span className="text-[13px] font-bold text-gray-900 dark:text-white flex-1">
                Past
              </span>
              <span className="badge-gray">{past.length}</span>
            </div>
            <div className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
              {past.map(ua => <MemberRow key={ua.id} ua={ua} dim />)}
            </div>
          </div>
        )}
      </div>

      <Modal
        open={!!selectedUnavailability}
        onClose={() => setSelectedUnavailability(null)}
        title="Unavailability Details"
      >
        {selectedUnavailability && (
          <>
            <div className="space-y-4">
              <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-gray-50 dark:bg-white/[0.04]">
                <Avatar
                  src={selectedUnavailability.profiles?.avatar_url}
                  firstName={selectedUnavailability.profiles?.first_name || '?'}
                  lastName={selectedUnavailability.profiles?.last_name}
                  size="lg"
                />
                <div>
                  <p className="text-base font-semibold text-gray-900 dark:text-white">
                    {selectedUnavailability.profiles?.first_name} {selectedUnavailability.profiles?.last_name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Team Member</p>
                </div>
              </div>

              <div>
                <p className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Date</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedUnavailability.leave_type === 'range' && selectedUnavailability.start_date && selectedUnavailability.end_date
                    ? `${format(parseISO(selectedUnavailability.start_date), 'MMM d')} – ${format(parseISO(selectedUnavailability.end_date), 'MMMM d, yyyy')}`
                    : selectedUnavailability.unavailable_date
                      ? format(parseISO(selectedUnavailability.unavailable_date), 'EEEE, MMMM d, yyyy')
                      : '—'}
                </p>
              </div>

              <div>
                <p className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Reason</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedUnavailability.reason || 'No reason provided'}
                </p>
              </div>

              <div>
                <p className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Status</p>
                <span className="badge-green">{selectedUnavailability.status}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              {isProductionDirector ? (
                <>
                  <button type="button" onClick={() => setSelectedUnavailability(null)} className="btn-secondary min-h-11">Close</button>
                  <button type="button" onClick={() => setShowDelete(true)} className="btn-danger min-h-11 flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setSelectedUnavailability(null)} className="btn-secondary min-h-11">Close</button>
              )}
            </div>
          </>
        )}
      </Modal>

      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete Request" size="sm">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Are you sure you want to delete the unavailability request for{' '}
          <strong>{selectedUnavailability?.profiles?.first_name} {selectedUnavailability?.profiles?.last_name}</strong> on{' '}
          <strong>{selectedUnavailability && (
            selectedUnavailability.leave_type === 'range' && selectedUnavailability.start_date && selectedUnavailability.end_date
              ? `${format(parseISO(selectedUnavailability.start_date), 'MMM d')} – ${format(parseISO(selectedUnavailability.end_date), 'MMM d, yyyy')}`
              : selectedUnavailability.unavailable_date
                ? format(parseISO(selectedUnavailability.unavailable_date), 'MMM d, yyyy')
                : '—'
          )}</strong>?
          This action cannot be undone.
        </p>
        <div className="mt-6 flex gap-3 justify-end">
          <button type="button" onClick={() => setShowDelete(false)} className="btn-secondary min-h-11">Cancel</button>
          <button type="button" onClick={handleDelete} disabled={deleting} className="btn-danger min-h-11">
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
