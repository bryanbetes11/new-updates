import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { Plus, Calendar, Trash2, Pencil, RotateCcw, Loader2, ClipboardCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { LeaveRequestModal } from '../components/LeaveRequestModal';
import { Modal } from '../components/Modal';
import { PageLoader } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import type { UserAvailability } from '../types';

const STATUS_TONE: Record<string, { label: string; cls: string; dot: string }> = {
  pending:   { label: 'Pending',   cls: 'bg-amber-50 dark:bg-amber-500/[0.12] text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25',     dot: '#f59e0b' },
  approved:  { label: 'Approved',  cls: 'bg-emerald-50 dark:bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25', dot: '#22c55e' },
  rejected:  { label: 'Rejected',  cls: 'bg-red-50 dark:bg-red-500/[0.12] text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/25',                  dot: '#ef4444' },
  withdrawn: { label: 'Withdrawn', cls: 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-white/45 border border-gray-200 dark:border-white/[0.08]',           dot: 'rgba(156,163,175,0.7)' },
};

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

export function RequestLeave() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [availability, setAvailability] = useState<UserAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; type: 'delete' | 'withdraw'; displayDate: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAvailability = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_availability')
      .select('*')
      .eq('user_id', user.id)
      .order('unavailable_date', { ascending: false });
    setAvailability(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAvailability(); }, [user]);

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    if (confirmAction.type === 'delete') {
      const { error } = await supabase.from('user_availability').delete().eq('id', confirmAction.id);
      if (error) { toast('error', 'Failed to withdraw leave request'); setActionLoading(false); return; }
      setAvailability(prev => prev.filter(a => a.id !== confirmAction.id));
      toast('success', 'Leave request withdrawn');
    } else {
      const { error } = await supabase.from('user_availability').update({ status: 'withdrawn' }).eq('id', confirmAction.id);
      if (error) { toast('error', 'Failed to cancel leave request'); setActionLoading(false); return; }
      setAvailability(prev => prev.map(a => a.id === confirmAction.id ? { ...a, status: 'withdrawn' } : a));
      toast('success', 'Leave request cancelled');
    }
    setActionLoading(false);
    setConfirmAction(null);
  };

  if (loading) return <PageLoader />;

  // Stats
  const counts = {
    pending: availability.filter(a => a.status === 'pending').length,
    approved: availability.filter(a => a.status === 'approved').length,
    total: availability.length,
  };
  const latestRequest = availability[0];
  const nextApproved = availability
    .filter(a => a.status === 'approved')
    .filter(a => (a.leave_type === 'single' ? a.unavailable_date : a.start_date))
    .sort((a, b) => String(a.leave_type === 'single' ? a.unavailable_date : a.start_date).localeCompare(String(b.leave_type === 'single' ? b.unavailable_date : b.start_date)))[0];

  return (
    <div className="page-container page-bottom-pad overflow-hidden">
      <div className="max-w-2xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-5 sm:space-y-6">

        {/* ── Availability Command Center ──────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[2rem] border border-amber-200/70 bg-[radial-gradient(circle_at_18%_20%,rgba(251,191,36,0.28),transparent_34%),linear-gradient(135deg,#fffaf0_0%,#ffffff_48%,#f8fafc_100%)] p-5 shadow-[0_24px_80px_-46px_rgba(146,64,14,0.65)] dark:border-white/[0.08] dark:bg-[radial-gradient(circle_at_16%_18%,rgba(245,158,11,0.18),transparent_34%),linear-gradient(135deg,#1c1307_0%,#10100d_46%,#070807_100%)] sm:p-6"
        >
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-amber-300/25 blur-3xl dark:bg-amber-500/10" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-orange-200/30 blur-3xl dark:bg-orange-500/10" />
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/[0.09]" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-70 animate-ping dark:bg-amber-400" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                </span>
                <p className="text-[10px] font-mono font-black uppercase tracking-[0.32em] text-amber-700/75 dark:text-amber-300/70">
                  Availability <span className="mx-1.5 text-amber-700/25 dark:text-white/20">·</span> Leave planning
                </p>
              </div>
              <h1
                className="mt-3 text-[2.35rem] font-black leading-none text-gray-950 dark:text-white sm:text-[3.15rem] lg:text-[3.65rem]"
                style={{ letterSpacing: '-0.065em' }}
              >
                Leave.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-white/52">
                Let leaders know when you are unavailable so schedules stay clean before assignments go out.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:min-w-[23rem]">
              {[
                { label: 'Total', value: counts.total },
                { label: 'Pending', value: counts.pending },
                { label: 'Approved', value: counts.approved },
              ].map(stat => (
                <div key={stat.label} className="rounded-2xl border border-white/70 bg-white/65 px-3 py-3 text-center shadow-sm backdrop-blur dark:border-white/[0.08] dark:bg-white/[0.05]">
                  <p className="text-lg font-black leading-none text-gray-950 dark:text-white">{stat.value}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-white/32">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-5 grid gap-3 border-t border-amber-900/[0.07] pt-4 dark:border-white/[0.07] md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
              {nextApproved ? (
                <>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700/70 dark:text-amber-300/80">Next approved leave</p>
                  <p className="mt-1 truncate text-sm font-extrabold text-gray-800 dark:text-white">
                    {format(parseISO((nextApproved.leave_type === 'single' ? nextApproved.unavailable_date : nextApproved.start_date)!), 'MMM d, yyyy')}
                    <span className="font-mono text-xs font-semibold text-gray-400 dark:text-amber-100/55"> · Leaders can plan around it</span>
                  </p>
                </>
              ) : latestRequest ? (
                <>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700/70 dark:text-amber-300/80">Latest request</p>
                  <p className="mt-1 truncate text-sm font-extrabold text-gray-800 dark:text-white">
                    {STATUS_TONE[latestRequest.status]?.label || 'Pending'}
                    <span className="font-mono text-xs font-semibold text-gray-400 dark:text-amber-100/55"> · {latestRequest.reason || 'No reason added'}</span>
                  </p>
                </>
              ) : (
                <p className="text-sm font-semibold text-gray-500 dark:text-white/70">No leave requests yet.</p>
              )}
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-5 text-[12px] font-black text-white shadow-[0_12px_28px_-16px_rgba(180,83,9,0.9)] transition-all active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            >
              <Plus className="h-3.5 w-3.5" /> New request
            </button>
          </div>
        </motion.section>

        {/* ── Stats pills ───────────────────────────── */}
        {availability.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[1.6rem] border border-black/[0.05] bg-white/75 p-2 shadow-[0_16px_44px_-34px_rgba(15,23,42,0.65)] backdrop-blur-xl dark:border-white/[0.07] dark:bg-white/[0.035]"
          >
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Total',    value: counts.total,    dot: 'rgba(107,114,128,0.7)', dotDark: 'rgba(255,255,255,0.45)' },
                { label: 'Pending',  value: counts.pending,  dot: counts.pending > 0 ? '#f59e0b' : 'rgba(156,163,175,0.6)', dotDark: counts.pending > 0 ? '#f59e0b' : 'rgba(255,255,255,0.25)' },
                { label: 'Approved', value: counts.approved, dot: '#22c55e', dotDark: '#22c55e' },
              ].map(s => (
                <div
                  key={s.label}
                  className="flex h-10 flex-1 min-w-[9rem] items-center justify-center gap-2.5 rounded-[1.15rem] bg-gray-50/90 px-3 dark:bg-black/20"
                >
                  <span className="h-1.5 w-1.5 rounded-full dark:hidden" style={{ background: s.dot, boxShadow: `0 0 8px ${s.dot}` }} />
                  <span className="h-1.5 w-1.5 rounded-full hidden dark:block" style={{ background: s.dotDark, boxShadow: `0 0 8px ${s.dotDark}` }} />
                  <span className="text-[14px] font-bold tabular-nums text-gray-900 dark:text-white" style={{ letterSpacing: '-0.02em' }}>{s.value}</span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-white/45">{s.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── List ────────────────────────────────── */}
        {availability.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-8 w-8" />}
            title="No leave requests"
            description="Submit a leave request to let leaders know when you're unavailable."
            action={
              <button onClick={() => setShowModal(true)} className="btn-primary">
                <Plus className="h-4 w-4" /> Request Leave
              </button>
            }
          />
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-2.5"
          >
            {availability.map(a => {
              const tone = STATUS_TONE[a.status] || STATUS_TONE.pending;
              const isRange = a.leave_type === 'range' && a.start_date && a.end_date;
              const displayDate = a.leave_type === 'single' && a.unavailable_date
                ? format(parseISO(a.unavailable_date), 'EEEE, MMMM d, yyyy')
                : isRange
                  ? `${format(parseISO(a.start_date!), 'MMM d')} – ${format(parseISO(a.end_date!), 'MMM d, yyyy')}`
                  : 'Invalid date';
              const dateForIcon = a.leave_type === 'single' && a.unavailable_date
                ? a.unavailable_date
                : a.start_date ?? null;
              const dimChip = a.status === 'rejected' || a.status === 'withdrawn';

              return (
                <motion.div
                  key={a.id}
                  variants={itemVariants}
                  className="group relative rounded-3xl overflow-hidden bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.1] transition-all duration-200"
                  style={{
                    boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(15,23,42,0.10)',
                    opacity: a.status === 'withdrawn' ? 0.7 : 1,
                  }}
                >
                  <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />

                  <div className="relative flex items-center gap-3.5 px-4 sm:px-5 py-4">
                    {/* Date chip — gradient amber matching page accent */}
                    {dateForIcon ? (
                      <div
                        className={`relative flex flex-col items-center justify-center h-[52px] w-11 rounded-xl shrink-0 ${dimChip ? 'bg-gray-100 dark:bg-white/[0.05]' : ''}`}
                        style={dimChip ? {} : { background: 'linear-gradient(145deg, #f59e0b, #d97706)', boxShadow: '0 3px 10px rgba(245,158,11,0.3)' }}
                      >
                        <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${dimChip ? 'text-gray-400 dark:text-white/25' : 'text-white/65'}`}>
                          {format(parseISO(dateForIcon), 'MMM')}
                        </span>
                        <span className={`text-[22px] font-black leading-none mt-0.5 ${dimChip ? 'text-gray-500 dark:text-white/35' : 'text-white'}`} style={{ letterSpacing: '-0.04em' }}>
                          {format(parseISO(dateForIcon), 'd')}
                        </span>
                        <span className={`text-[8px] font-bold leading-none mt-0.5 ${dimChip ? 'text-gray-400 dark:text-white/20' : 'text-white/50'}`}>
                          {format(parseISO(dateForIcon), 'EEE')}
                        </span>
                      </div>
                    ) : (
                      <div className="h-[52px] w-11 rounded-xl shrink-0 bg-gray-100 dark:bg-white/[0.05]" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14px] font-bold text-gray-900 dark:text-white leading-snug" style={{ letterSpacing: '-0.015em' }}>{displayDate}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${tone.cls}`}>{tone.label}</span>
                        {isRange && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-white/45">Range</span>
                        )}
                      </div>
                      {a.reason && (
                        <p className="text-[12px] text-gray-500 dark:text-white/45 mt-1 leading-relaxed line-clamp-2">{a.reason}</p>
                      )}
                    </div>

                    {(a.status === 'pending' || a.status === 'approved') && (
                      <div className="flex items-center gap-1 shrink-0">
                        {a.status === 'pending' && (
                          <button
                            onClick={() => setShowModal(true)}
                            className="h-8 w-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/[0.12] transition-colors"
                            title="Edit request"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {a.status === 'pending' && (
                          <button
                            onClick={() => setConfirmAction({ id: a.id, type: 'delete', displayDate })}
                            className="h-8 w-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/[0.12] transition-colors"
                            title="Withdraw request"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {a.status === 'approved' && (
                          <button
                            onClick={() => setConfirmAction({ id: a.id, type: 'withdraw', displayDate })}
                            className="h-8 w-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/[0.12] transition-colors"
                            title="Cancel approved request"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Confirm modal */}
      <Modal
        open={!!confirmAction}
        onClose={() => !actionLoading && setConfirmAction(null)}
        title={confirmAction?.type === 'delete' ? 'Withdraw Request' : 'Cancel Approved Request'}
        size="sm"
      >
        {confirmAction && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {confirmAction.type === 'delete'
                ? <>Are you sure you want to withdraw your leave request for <span className="font-semibold text-gray-900 dark:text-white">{confirmAction.displayDate}</span>? This will permanently remove the request.</>
                : <>Are you sure you want to cancel your approved leave for <span className="font-semibold text-gray-900 dark:text-white">{confirmAction.displayDate}</span>? Leadership will be notified of the change.</>
              }
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmAction(null)} disabled={actionLoading} className="btn-secondary">Keep it</button>
              <button
                onClick={handleConfirmAction}
                disabled={actionLoading}
                className={`btn-primary ${confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700 ring-red-300' : 'bg-amber-600 hover:bg-amber-700 ring-amber-300'}`}
              >
                {actionLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : confirmAction.type === 'delete' ? <Trash2 className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />
                }
                {actionLoading ? 'Processing...' : confirmAction.type === 'delete' ? 'Withdraw' : 'Cancel Request'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <LeaveRequestModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchAvailability}
      />
    </div>
  );
}
