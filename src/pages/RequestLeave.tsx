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

  return (
    <div className="page-container page-bottom-pad">
      <div className="max-w-2xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-5 sm:space-y-6">

        {/* ── Header ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-start justify-between gap-3"
        >
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <div
                className="absolute inset-0 rounded-2xl"
                style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.35), transparent 70%)', filter: 'blur(10px)', transform: 'scale(1.5)' }}
              />
              <div
                className="relative h-11 w-11 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(145deg, #f59e0b, #d97706)', boxShadow: '0 4px 14px rgba(245,158,11,0.35)' }}
              >
                <ClipboardCheck className="h-5 w-5 text-white" />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-mono font-medium uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400/80 mb-0.5">
                Availability
              </p>
              <h1 className="text-[1.5rem] sm:text-[1.75rem] font-black text-gray-900 dark:text-white leading-tight" style={{ letterSpacing: '-0.03em' }}>
                Request Leave.
              </h1>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-[12px] font-semibold text-white shrink-0 transition-all active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 14px rgba(245,158,11,0.35)' }}
          >
            <Plus className="h-3.5 w-3.5" /> New Request
          </button>
        </motion.div>

        {/* ── Stats pills ───────────────────────────── */}
        {availability.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap gap-2"
          >
            {[
              { label: 'Total',    value: counts.total,    dot: 'rgba(107,114,128,0.7)', dotDark: 'rgba(255,255,255,0.45)' },
              { label: 'Pending',  value: counts.pending,  dot: counts.pending > 0 ? '#f59e0b' : 'rgba(156,163,175,0.6)', dotDark: counts.pending > 0 ? '#f59e0b' : 'rgba(255,255,255,0.25)' },
              { label: 'Approved', value: counts.approved, dot: '#22c55e', dotDark: '#22c55e' },
            ].map(s => (
              <div
                key={s.label}
                className="flex items-center gap-2.5 pl-3 pr-4 h-9 rounded-full bg-white/70 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.07] backdrop-blur-md"
              >
                <span className="h-1.5 w-1.5 rounded-full dark:hidden" style={{ background: s.dot, boxShadow: `0 0 8px ${s.dot}` }} />
                <span className="h-1.5 w-1.5 rounded-full hidden dark:block" style={{ background: s.dotDark, boxShadow: `0 0 8px ${s.dotDark}` }} />
                <span className="text-[14px] font-bold tabular-nums text-gray-900 dark:text-white" style={{ letterSpacing: '-0.02em' }}>{s.value}</span>
                <span className="text-[11px] font-medium text-gray-500 dark:text-white/45 tracking-tight">{s.label}</span>
              </div>
            ))}
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
