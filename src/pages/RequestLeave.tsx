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
      <div className="max-w-2xl lg:max-w-6xl xl:max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 space-y-5 sm:space-y-6">

        {/* ── Availability Command Center ──────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[2rem] border border-emerald-200/70 bg-[radial-gradient(circle_at_18%_20%,rgba(110,231,183,0.24),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(167,243,208,0.18),transparent_36%),linear-gradient(135deg,#f5fff9_0%,#ffffff_48%,#f6faf8_100%)] p-5 shadow-[0_24px_80px_-46px_rgba(16,185,129,0.35)] dark:border-emerald-500/20 dark:bg-[radial-gradient(circle_at_16%_18%,rgba(16,185,129,0.16),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(52,211,153,0.10),transparent_36%),linear-gradient(135deg,#0f1814_0%,#0d1110_46%,#070807_100%)] sm:p-6"
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/[0.09]" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-70 animate-ping dark:bg-emerald-400" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                </span>
                <p className="text-[10px] font-mono font-black uppercase tracking-[0.32em] text-emerald-700/75 dark:text-emerald-300/70">
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
                <div key={stat.label} className="rounded-2xl border border-white bg-white px-3 py-3 text-center shadow-sm dark:border-white/[0.08] dark:bg-white/[0.05]">
                  <p className="text-lg font-black leading-none text-gray-950 dark:text-white">{stat.value}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-white/32">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-5 grid gap-3 border-t border-emerald-900/[0.07] pt-4 dark:border-white/[0.07] md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
              {nextApproved ? (
                <>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700/70 dark:text-emerald-300/80">Next approved leave</p>
                  <p className="mt-1 truncate text-sm font-extrabold text-gray-800 dark:text-white">
                    {format(parseISO((nextApproved.leave_type === 'single' ? nextApproved.unavailable_date : nextApproved.start_date)!), 'MMM d, yyyy')}
                    <span className="font-mono text-xs font-semibold text-gray-400 dark:text-emerald-100/55"> · Leaders can plan around it</span>
                  </p>
                </>
              ) : latestRequest ? (
                <>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700/70 dark:text-emerald-300/80">Latest request</p>
                  <p className="mt-1 truncate text-sm font-extrabold text-gray-800 dark:text-white">
                    {STATUS_TONE[latestRequest.status]?.label || 'Pending'}
                    <span className="font-mono text-xs font-semibold text-gray-400 dark:text-emerald-100/55"> · {latestRequest.reason || 'No reason added'}</span>
                  </p>
                </>
              ) : (
                <p className="text-sm font-semibold text-gray-500 dark:text-white/70">No leave requests yet.</p>
              )}
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-5 text-[12px] font-black text-white shadow-[0_12px_28px_-16px_rgba(180,83,9,0.9)] transition-all active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
            >
              <Plus className="h-3.5 w-3.5" /> New request
            </button>
          </div>
        </motion.section>

        {/* ── List ────────────────────────────────── */}
        {availability.length === 0 ? (
          <div className="relative overflow-hidden rounded-[2rem] border border-black/[0.05] bg-white/90 px-5 py-6 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.32)] dark:border-white/[0.07] dark:bg-white/[0.035] sm:px-6">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] to-transparent dark:via-white/[0.1]" />
            <div className="flex items-center gap-3 text-[11px] font-mono font-black uppercase tracking-[0.28em] text-gray-400 dark:text-white/35">
              <span>02</span>
              <span className="text-gray-300 dark:text-white/15">|</span>
              <span>Leave requests</span>
            </div>
            <div className="pt-4">
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
            </div>
          </div>
        ) : (
          <motion.section
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="relative overflow-hidden rounded-[2rem] border border-black/[0.05] bg-white/90 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.32)] dark:border-white/[0.07] dark:bg-white/[0.035]"
          >
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] to-transparent dark:via-white/[0.1]" />
            <div className="px-5 pt-5 pb-3 sm:px-6">
              <div className="flex items-center gap-3 text-[11px] font-mono font-black uppercase tracking-[0.28em] text-gray-400 dark:text-white/35">
                <span>02</span>
                <span className="text-gray-300 dark:text-white/15">|</span>
                <span>Leave requests</span>
              </div>
            </div>
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
                  className="group relative transition-all duration-200"
                  style={{
                    opacity: a.status === 'withdrawn' ? 0.7 : 1,
                  }}
                >
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.05] dark:via-white/[0.08] to-transparent" />

                  <div className="relative flex items-center gap-3.5 px-5 py-4 sm:px-6">
                    {/* Date chip — gradient amber matching page accent */}
                    {dateForIcon ? (
                      <div
                        className={`relative flex flex-col items-center justify-center h-[52px] w-11 rounded-xl shrink-0 ${dimChip ? 'bg-gray-100 dark:bg-white/[0.05]' : ''}`}
                        style={dimChip ? {} : { background: 'linear-gradient(145deg, #22c55e, #16a34a)', boxShadow: '0 3px 10px rgba(34,197,94,0.28)' }}
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
                            className="h-8 w-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/[0.12] transition-colors"
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
                            className="h-8 w-8 rounded-xl flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/[0.12] transition-colors"
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
          </motion.section>
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
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={actionLoading}
                className="btn-secondary min-h-[3.75rem] w-full justify-center whitespace-nowrap px-4 text-center"
              >
                Keep it
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={actionLoading}
                className={`btn-primary min-h-[3.75rem] w-full justify-center whitespace-nowrap px-4 text-center ${confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700 ring-red-300' : 'bg-amber-600 hover:bg-amber-700 ring-amber-300'}`}
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
