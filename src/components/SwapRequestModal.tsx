import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format, isAfter, parseISO, startOfToday } from 'date-fns';
import { ArrowLeftRight, Calendar, ChevronRight, Clock, Search, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal } from './Modal';
import { Avatar } from './Avatar';
import { formatTime12Hour } from '../lib/timeFormat';
import type { EventAssignment, Profile } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  myAssignment: EventAssignment | null;
}

type Step = 'pick_member' | 'pick_assignment' | 'reason';

const stepVariants = {
  enter: (dir: number) => ({ x: dir * 28, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -28, opacity: 0 }),
};
const stepTransition = { type: 'tween', duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] } as const;

export function SwapRequestModal({ open, onClose, myAssignment }: Props) {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const myRoleName = myAssignment?.roles?.name ?? '';
  const isSub = myRoleName !== 'Song Leader'; // non-song-leader = sub request
  const STEP_ORDER: Step[] = isSub
    ? ['pick_member', 'reason']
    : ['pick_member', 'pick_assignment', 'reason'];

  const [step, setStep] = useState<Step>('pick_member');
  const [direction, setDirection] = useState(1);
  const goTo = (s: Step) => {
    setDirection(STEP_ORDER.indexOf(s) > STEP_ORDER.indexOf(step) ? 1 : -1);
    setStep(s);
  };

  const [members, setMembers] = useState<Profile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  // For sub mode: track who's already on this event
  const [assignedToEvent, setAssignedToEvent] = useState<Set<string>>(new Set());
  const [assignedRoleNames, setAssignedRoleNames] = useState<Record<string, string>>({});

  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  // Swap-only: pick target's assignment
  const [targetAssignments, setTargetAssignments] = useState<EventAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<EventAssignment | null>(null);

  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load eligible members
  useEffect(() => {
    if (!open || !user || !myAssignment) return;
    setLoadingMembers(true);
    setMembers([]);
    setAssignedToEvent(new Set());
    setAssignedRoleNames({});

    if (!isSub) {
      // ── Swap (Song Leader): members who have upcoming Song Leader assignments ──
      supabase
        .from('roles')
        .select('id')
        .eq('name', 'Song Leader')
        .maybeSingle()
        .then(({ data: roleData }) => {
          if (!roleData) { setLoadingMembers(false); return; }
          const today = startOfToday().toISOString().split('T')[0];
          supabase
            .from('event_assignments')
            .select('user_id, profiles!event_assignments_user_id_fkey(id, first_name, last_name, nickname, avatar_url), events(event_date)')
            .eq('role_id', roleData.id)
            .neq('status', 'declined')
            .neq('user_id', user.id)
            .gte('events.event_date', today)
            .then(({ data }) => {
              const seen = new Set<string>();
              const eligible: Profile[] = [];
              for (const a of (data || []) as any[]) {
                if (!a.events || !a.profiles) continue;
                if (seen.has(a.user_id)) continue;
                seen.add(a.user_id);
                eligible.push(a.profiles as Profile);
              }
              eligible.sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''));
              setMembers(eligible);
              setLoadingMembers(false);
            });
        });
    } else {
      // ── Sub (non-Song Leader): members who have that role in their profile ──
      // Also check who's already assigned to this specific event
      supabase
        .from('roles')
        .select('id')
        .eq('name', myRoleName)
        .maybeSingle()
        .then(async ({ data: roleData }) => {
          if (!roleData) { setLoadingMembers(false); return; }

          const eventId = myAssignment.event_id || (myAssignment as any).events?.id;

          const [{ data: urData }, { data: evtData }] = await Promise.all([
            supabase
              .from('user_roles')
              .select('user_id, profiles!user_roles_user_id_fkey(id, first_name, last_name, nickname, avatar_url)')
              .eq('role_id', roleData.id)
              .neq('user_id', user.id),
            supabase
              .from('event_assignments')
              .select('user_id, roles(name)')
              .eq('event_id', eventId)
              .neq('status', 'declined'),
          ]);

          const assignedIds = new Set<string>((evtData || []).map((a: any) => a.user_id as string));
          const roleMap: Record<string, string> = {};
          for (const a of (evtData || []) as any[]) {
            roleMap[a.user_id] = a.roles?.name || 'another role';
          }
          setAssignedToEvent(assignedIds);
          setAssignedRoleNames(roleMap);

          const eligible = ((urData || []) as any[]).map(ur => ur.profiles).filter(Boolean) as Profile[];
          eligible.sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''));
          setMembers(eligible);
          setLoadingMembers(false);
        });
    }
  }, [open, user, myAssignment]); // eslint-disable-line react-hooks/exhaustive-deps

  // Swap mode only: load target member's upcoming assignments for the same role
  useEffect(() => {
    if (isSub || !selectedMember || !myAssignment) return;
    setLoadingAssignments(true);
    setTargetAssignments([]);
    supabase
      .from('event_assignments')
      .select('*, events(*), roles(*)')
      .eq('user_id', selectedMember.id)
      .neq('status', 'declined')
      .then(({ data }) => {
        const upcoming = ((data || []) as EventAssignment[])
          .filter(a =>
            a.events &&
            isAfter(parseISO(a.events.event_date), startOfToday()) &&
            a.roles?.name === myRoleName
          )
          .sort((a, b) => parseISO(a.events!.event_date).getTime() - parseISO(b.events!.event_date).getTime());
        setTargetAssignments(upcoming);
        setLoadingAssignments(false);
      });
  }, [selectedMember, myRoleName, isSub]);

  const reset = () => {
    setDirection(1);
    setStep('pick_member');
    setMemberSearch('');
    setSelectedMember(null);
    setTargetAssignments([]);
    setSelectedTarget(null);
    setReason('');
    setAssignedToEvent(new Set());
    setAssignedRoleNames({});
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!user || !myAssignment || !selectedMember || !reason.trim()) return;
    if (!isSub && !selectedTarget) return;
    setSubmitting(true);
    try {
      const { data: sr, error } = await supabase
        .from('swap_requests')
        .insert({
          requester_id: user.id,
          target_id: selectedMember.id,
          requester_assignment_id: myAssignment.id,
          target_assignment_id: isSub ? null : selectedTarget!.id,
          reason: reason.trim(),
          status: 'pending_target',
        })
        .select()
        .single();

      if (error) throw error;

      const requesterName = profile?.nickname || `${profile?.first_name} ${profile?.last_name}`.trim();
      const myEventTitle = myAssignment.events?.title || 'an event';

      const notifTitle = isSub
        ? `${requesterName} is looking for a sub`
        : `${requesterName} wants to swap schedules`;
      const notifBody = isSub
        ? `They need someone to cover their ${myRoleName} spot at ${myEventTitle}. Tap to respond.`
        : `They're offering their spot at ${myEventTitle} in exchange for your spot at ${selectedTarget!.events?.title || 'an event'}. Tap to respond.`;

      await supabase.from('notifications').insert({
        user_id: selectedMember.id,
        type: isSub ? 'sub_request' : 'swap_request',
        title: notifTitle,
        body: notifBody,
        data: { swap_request_id: sr.id, url: '/my-assignments' },
      });

      toast('success', isSub ? 'Sub request sent!' : 'Swap request sent!');
      handleClose();
    } catch {
      toast('error', isSub ? 'Failed to send sub request' : 'Failed to send swap request');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMembers = members.filter(m => {
    const q = memberSearch.toLowerCase();
    const name = `${m.first_name} ${m.last_name} ${m.nickname || ''}`.toLowerCase();
    return name.includes(q);
  });

  const stepTitle =
    step === 'pick_member'
      ? (isSub ? 'Who can cover for you?' : 'Who do you want to swap with?')
      : step === 'pick_assignment'
      ? `Pick ${selectedMember?.nickname || selectedMember?.first_name}'s event`
      : isSub ? 'Why do you need a sub?' : 'Why do you want to swap?';

  if (!myAssignment) return null;

  const modalTitle = isSub ? 'Find a Sub' : 'Request Schedule Swap';

  return (
    <Modal open={open} onClose={handleClose} title={modalTitle} size="md">
      {/* My assignment summary */}
      <div className="mb-4 rounded-2xl bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800/30 px-4 py-3">
        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400 mb-1">Your assignment</p>
        <p className="text-[14px] font-bold text-gray-900 dark:text-white leading-tight" style={{ letterSpacing: '-0.02em' }}>
          {myAssignment.events?.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {myAssignment.events?.event_date && (
            <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-white/45 font-mono">
              <Calendar className="h-3 w-3" />
              {format(parseISO(myAssignment.events.event_date), 'EEE, MMM d')}
            </span>
          )}
          {myAssignment.events?.start_time && (
            <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-white/45 font-mono">
              <Clock className="h-3 w-3" />
              {formatTime12Hour(myAssignment.events.start_time)}
            </span>
          )}
          {myAssignment.roles?.name && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white dark:bg-white/[0.08] border border-black/[0.06] dark:border-white/[0.08] text-gray-600 dark:text-white/60">
              {myAssignment.roles.name}
            </span>
          )}
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1.5 mb-4">
        {STEP_ORDER.map((s, i) => (
          <div key={s} className={`h-1 flex-1 rounded-full transition-all ${
            step === s ? 'bg-brand-500' :
            STEP_ORDER.indexOf(step) > i ? 'bg-brand-300 dark:bg-brand-700' :
            'bg-gray-200 dark:bg-white/[0.08]'
          }`} />
        ))}
      </div>

      <p className="text-[13px] font-semibold text-gray-700 dark:text-white/70 mb-3">{stepTitle}</p>

      <div className="overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>

          {/* ── Step 1: Pick member ── */}
          {step === 'pick_member' && (
            <motion.div
              key="pick_member"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={stepTransition}
              className="space-y-2"
            >
              <div className="flex items-center gap-1.5 px-1 mb-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-brand-600 dark:text-brand-400">
                  {isSub
                    ? `Members with ${myRoleName} role`
                    : 'Song Leaders with upcoming events'}
                </span>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 dark:text-white/30" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-[13px] bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none focus:border-brand-400 dark:focus:border-brand-500 transition-colors"
                />
              </div>

              <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-200 dark:border-white/[0.07] divide-y divide-gray-100 dark:divide-white/[0.05]">
                {loadingMembers ? (
                  <p className="px-4 py-6 text-center text-[13px] text-gray-400 dark:text-white/30">Loading…</p>
                ) : filteredMembers.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-[13px] text-gray-400 dark:text-white/30">
                      {members.length === 0
                        ? `No members with ${myRoleName} role found`
                        : 'No members found'}
                    </p>
                  </div>
                ) : filteredMembers.map(m => {
                  const alreadyOn = isSub && assignedToEvent.has(m.id);
                  return (
                    <button
                      key={m.id}
                      disabled={alreadyOn}
                      onClick={() => {
                        if (alreadyOn) return;
                        setSelectedMember(m);
                        goTo(isSub ? 'reason' : 'pick_assignment');
                      }}
                      className={`group flex items-center gap-3 px-4 py-3 w-full text-left transition-colors ${
                        alreadyOn
                          ? 'opacity-60 cursor-not-allowed'
                          : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      <Avatar src={m.avatar_url} firstName={m.first_name || '?'} lastName={m.last_name} size="sm" className="rounded-xl shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="block text-[13px] font-semibold text-gray-900 dark:text-white">
                          {m.nickname || `${m.first_name} ${m.last_name}`}
                        </span>
                        {alreadyOn && (
                          <span className="block text-[11px] font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                            Already assigned to this event as {assignedRoleNames[m.id]}
                          </span>
                        )}
                      </div>
                      {!alreadyOn && (
                        <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-white/20 group-hover:text-gray-500 transition-colors shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Pick target assignment (swap / Song Leader only) ── */}
          {step === 'pick_assignment' && (
            <motion.div
              key="pick_assignment"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={stepTransition}
              className="space-y-2"
            >
              <button onClick={() => goTo('pick_member')} className="flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60 transition-colors mb-1">
                ← Back
              </button>
              {loadingAssignments ? (
                <div className="py-8 text-center text-[13px] text-gray-400 dark:text-white/30">Loading assignments…</div>
              ) : targetAssignments.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-[13px] font-medium text-gray-500 dark:text-white/40">No matching assignments</p>
                  <p className="text-[11px] text-gray-400 dark:text-white/25 mt-1">
                    {selectedMember?.first_name} has no upcoming Song Leader events to swap.
                  </p>
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-200 dark:border-white/[0.07] divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {targetAssignments.map(a => (
                    <button
                      key={a.id}
                      onClick={() => { setSelectedTarget(a); goTo('reason'); }}
                      className="group flex items-center gap-3 px-4 py-3.5 w-full text-left hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center h-10 w-10 rounded-lg bg-brand-50 dark:bg-brand-900/25 text-brand-700 dark:text-brand-300 shrink-0">
                        <span className="font-mono text-[8px] font-semibold uppercase leading-none">
                          {a.events?.event_date && format(parseISO(a.events.event_date), 'MMM')}
                        </span>
                        <span className="font-mono text-[17px] font-bold leading-none mt-0.5" style={{ letterSpacing: '-0.03em' }}>
                          {a.events?.event_date && format(parseISO(a.events.event_date), 'd')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">{a.events?.title}</p>
                        {a.events?.event_type && (
                          <span className="inline-block text-[9px] font-mono font-bold uppercase tracking-[0.15em] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-white/35 mt-0.5 mb-0.5">
                            {a.events.event_type}
                          </span>
                        )}
                        <p className="text-[11px] text-gray-500 dark:text-white/40 font-mono mt-0.5">
                          {a.roles?.name}{a.events?.start_time && ` · ${formatTime12Hour(a.events.start_time)}`}
                        </p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-white/20 group-hover:text-gray-500 transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Step 3: Reason ── */}
          {step === 'reason' && (
            <motion.div
              key="reason"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={stepTransition}
              className="space-y-3"
            >
              <button
                onClick={() => goTo(isSub ? 'pick_member' : 'pick_assignment')}
                className="flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60 transition-colors"
              >
                ← Back
              </button>

              {/* Summary card */}
              {isSub ? (
                /* Sub summary: just your event + who covers */
                <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] overflow-hidden">
                  <div className="px-4 py-3 bg-brand-50/60 dark:bg-brand-900/10">
                    <p className="text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-brand-600 dark:text-brand-400 mb-1">You need a sub for</p>
                    <p className="text-[12px] font-bold text-gray-900 dark:text-white leading-tight">{myAssignment.events?.title}</p>
                    <p className="text-[10px] text-gray-500 dark:text-white/40 font-mono mt-0.5">
                      {myAssignment.events?.event_date && format(parseISO(myAssignment.events.event_date), 'EEE, MMM d')}
                      {myAssignment.roles?.name && ` · ${myAssignment.roles.name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/[0.06]">
                    <UserPlus className="h-3 w-3 text-gray-400 dark:text-white/25 shrink-0" />
                    <p className="text-[11px] text-gray-500 dark:text-white/40 font-mono">
                      {selectedMember?.nickname || `${selectedMember?.first_name} ${selectedMember?.last_name}`} will be asked to cover
                    </p>
                  </div>
                </div>
              ) : (
                /* Swap summary: two-column exchange */
                selectedTarget && (
                  <div className="rounded-2xl border border-gray-200 dark:border-white/[0.07] overflow-hidden">
                    <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-white/[0.07]">
                      <div className="px-3 py-3 bg-brand-50/50 dark:bg-brand-900/10">
                        <p className="text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-brand-600 dark:text-brand-400 mb-1">You give up</p>
                        <p className="text-[12px] font-bold text-gray-900 dark:text-white leading-tight truncate">{myAssignment.events?.title}</p>
                        <p className="text-[10px] text-gray-500 dark:text-white/40 font-mono mt-0.5">
                          {myAssignment.events?.event_date && format(parseISO(myAssignment.events.event_date), 'MMM d')}
                        </p>
                      </div>
                      <div className="px-3 py-3">
                        <p className="text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400 mb-1">You receive</p>
                        <p className="text-[12px] font-bold text-gray-900 dark:text-white leading-tight truncate">{selectedTarget.events?.title}</p>
                        <p className="text-[10px] text-gray-500 dark:text-white/40 font-mono mt-0.5">
                          {selectedTarget.events?.event_date && format(parseISO(selectedTarget.events.event_date), 'MMM d')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/[0.06]">
                      <ArrowLeftRight className="h-3 w-3 text-gray-400 dark:text-white/25" />
                      <p className="text-[10px] text-gray-500 dark:text-white/40 font-mono">
                        Swapping with {selectedMember?.nickname || `${selectedMember?.first_name} ${selectedMember?.last_name}`}
                      </p>
                    </div>
                  </div>
                )
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-white/40 mb-1.5">
                  Reason <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. I have a prior commitment on that date…"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-[13px] bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none focus:border-brand-400 dark:focus:border-brand-500 resize-none transition-colors"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={handleClose} className="flex-1 btn-secondary" disabled={submitting}>
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!reason.trim() || submitting}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {submitting ? 'Sending…' : isSub ? 'Send Sub Request' : 'Send Swap Request'}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </Modal>
  );
}
