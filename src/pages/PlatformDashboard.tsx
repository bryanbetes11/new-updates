import { useEffect, useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { motion } from 'framer-motion';
import { ArrowLeft, Building2, CalendarClock, CheckCircle2, CreditCard, Loader2, LogOut, Shield, Sparkles, Users, UserPlus, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { PageLoader } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import type {
  PlatformPaymentSubmission,
  PlatformOrganizationDetail,
  PlatformOrganizationMember,
  PlatformOrganizationSummary,
  PlatformOverviewMetrics,
  PlatformRecentRegistration,
} from '../types';

type DashboardChurch = PlatformOrganizationSummary & { isPreview?: boolean };
type DashboardChurchDetail = PlatformOrganizationDetail & { isPreview?: boolean };
type DashboardChurchMember = PlatformOrganizationMember & { isPreview?: boolean };

const container = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

const item = {
  initial: { opacity: 0, y: 18, filter: 'blur(6px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

const surfaceCardClass = 'relative overflow-hidden rounded-3xl bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06]';
const surfaceCardStyle = {
  boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 28px -16px rgba(15,23,42,0.12)',
};

function formatStatus(status: string | null) {
  if (!status) return 'Exempt / not active';
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return format(new Date(value), 'MMM d, yyyy');
}

function statusTone(status: string | null) {
  if (status === 'active') return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300';
  if (status === 'trialing') return 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300';
  if (status === 'past_due') return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300';
  if (status === 'canceled') return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300';
  return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-white/70';
}

const previewChurches: DashboardChurch[] = [
  {
    id: 'preview-grace',
    name: 'Grace Worship Center',
    slug: 'grace-worship-center',
    subscription_status: 'trialing',
    stripe_customer_id: null,
    stripe_subscription_id: null,
    trial_ends_at: '2026-05-18T00:00:00.000Z',
    current_period_end: null,
    seats_purchased: 12,
    created_at: '2026-04-29T08:00:00.000Z',
    member_count: 14,
    org_admin_count: 2,
    event_count: 6,
    announcement_count: 4,
    pending_invite_count: 3,
    isPreview: true,
  },
  {
    id: 'preview-river',
    name: 'River City Church',
    slug: 'river-city-church',
    subscription_status: 'active',
    stripe_customer_id: 'cus_preview_river',
    stripe_subscription_id: 'sub_preview_river',
    trial_ends_at: null,
    current_period_end: '2026-06-01T00:00:00.000Z',
    seats_purchased: 24,
    created_at: '2026-04-20T08:00:00.000Z',
    member_count: 27,
    org_admin_count: 3,
    event_count: 11,
    announcement_count: 8,
    pending_invite_count: 1,
    isPreview: true,
  },
  {
    id: 'preview-lighthouse',
    name: 'Lighthouse Fellowship',
    slug: 'lighthouse-fellowship',
    subscription_status: 'past_due',
    stripe_customer_id: 'cus_preview_light',
    stripe_subscription_id: 'sub_preview_light',
    trial_ends_at: null,
    current_period_end: '2026-05-05T00:00:00.000Z',
    seats_purchased: 18,
    created_at: '2026-04-17T08:00:00.000Z',
    member_count: 19,
    org_admin_count: 1,
    event_count: 9,
    announcement_count: 5,
    pending_invite_count: 0,
    isPreview: true,
  },
  {
    id: 'preview-revival',
    name: 'Revival House',
    slug: 'revival-house',
    subscription_status: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    trial_ends_at: null,
    current_period_end: null,
    seats_purchased: 8,
    created_at: '2026-04-14T08:00:00.000Z',
    member_count: 9,
    org_admin_count: 1,
    event_count: 4,
    announcement_count: 2,
    pending_invite_count: 2,
    isPreview: true,
  },
];

const previewDetails: Record<string, DashboardChurchDetail> = {
  'preview-grace': {
    id: 'preview-grace',
    name: 'Grace Worship Center',
    slug: 'grace-worship-center',
    logo_url: '',
    subscription_status: 'trialing',
    stripe_customer_id: null,
    stripe_subscription_id: null,
    trial_ends_at: '2026-05-18T00:00:00.000Z',
    current_period_end: null,
    seats_purchased: 12,
    created_at: '2026-04-29T08:00:00.000Z',
    isPreview: true,
  },
  'preview-river': {
    id: 'preview-river',
    name: 'River City Church',
    slug: 'river-city-church',
    logo_url: '',
    subscription_status: 'active',
    stripe_customer_id: 'cus_preview_river',
    stripe_subscription_id: 'sub_preview_river',
    trial_ends_at: null,
    current_period_end: '2026-06-01T00:00:00.000Z',
    seats_purchased: 24,
    created_at: '2026-04-20T08:00:00.000Z',
    isPreview: true,
  },
  'preview-lighthouse': {
    id: 'preview-lighthouse',
    name: 'Lighthouse Fellowship',
    slug: 'lighthouse-fellowship',
    logo_url: '',
    subscription_status: 'past_due',
    stripe_customer_id: 'cus_preview_light',
    stripe_subscription_id: 'sub_preview_light',
    trial_ends_at: null,
    current_period_end: '2026-05-05T00:00:00.000Z',
    seats_purchased: 18,
    created_at: '2026-04-17T08:00:00.000Z',
    isPreview: true,
  },
  'preview-revival': {
    id: 'preview-revival',
    name: 'Revival House',
    slug: 'revival-house',
    logo_url: '',
    subscription_status: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    trial_ends_at: null,
    current_period_end: null,
    seats_purchased: 8,
    created_at: '2026-04-14T08:00:00.000Z',
    isPreview: true,
  },
};

const previewMembers: Record<string, DashboardChurchMember[]> = {
  'preview-grace': [
    { profile_id: 'p1', email: 'pastor@grace.example', first_name: 'Elijah', last_name: 'Reyes', nickname: 'Pastor Eli', is_org_admin: true, is_onboarded: true, ministry_status: 'active', created_at: '2026-04-29T08:00:00.000Z', isPreview: true },
    { profile_id: 'p2', email: 'music@grace.example', first_name: 'Mia', last_name: 'Santos', nickname: null, is_org_admin: false, is_onboarded: true, ministry_status: 'active', created_at: '2026-04-30T08:00:00.000Z', isPreview: true },
  ],
  'preview-river': [
    { profile_id: 'p3', email: 'admin@river.example', first_name: 'Noah', last_name: 'Mendoza', nickname: null, is_org_admin: true, is_onboarded: true, ministry_status: 'active', created_at: '2026-04-20T08:00:00.000Z', isPreview: true },
    { profile_id: 'p4', email: 'stage@river.example', first_name: 'Ava', last_name: 'Garcia', nickname: null, is_org_admin: false, is_onboarded: true, ministry_status: 'active', created_at: '2026-04-22T08:00:00.000Z', isPreview: true },
  ],
  'preview-lighthouse': [
    { profile_id: 'p5', email: 'lead@lighthouse.example', first_name: 'Lucas', last_name: 'Torres', nickname: null, is_org_admin: true, is_onboarded: true, ministry_status: 'active', created_at: '2026-04-17T08:00:00.000Z', isPreview: true },
  ],
  'preview-revival': [
    { profile_id: 'p6', email: 'hello@revival.example', first_name: 'Hannah', last_name: 'Cruz', nickname: null, is_org_admin: true, is_onboarded: false, ministry_status: 'active', created_at: '2026-04-14T08:00:00.000Z', isPreview: true },
  ],
};

export function PlatformDashboard() {
  const { isPlatformOwner, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showAllRegistrations, setShowAllRegistrations] = useState(false);
  const [churchModalOpen, setChurchModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewingSubmissionId, setReviewingSubmissionId] = useState<string | null>(null);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [submissionToReject, setSubmissionToReject] = useState<PlatformPaymentSubmission | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [metrics, setMetrics] = useState<PlatformOverviewMetrics | null>(null);
  const [churches, setChurches] = useState<PlatformOrganizationSummary[]>([]);
  const [registrations, setRegistrations] = useState<PlatformRecentRegistration[]>([]);
  const [paymentSubmissions, setPaymentSubmissions] = useState<PlatformPaymentSubmission[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState<string | null>(null);
  const [selectedChurch, setSelectedChurch] = useState<DashboardChurchDetail | null>(null);
  const [churchMembers, setChurchMembers] = useState<DashboardChurchMember[]>([]);
  const [churchForm, setChurchForm] = useState({
    name: '',
    logo_url: '',
    subscription_status: '',
    trial_ends_at: '',
    current_period_end: '',
    seats_purchased: '0',
  });

  const displayChurches = useMemo<DashboardChurch[]>(() => {
    const realChurches = churches.map(church => ({ ...church, isPreview: false }));
    const needed = Math.max(0, 5 - realChurches.length);
    return [...realChurches, ...previewChurches.slice(0, needed)];
  }, [churches]);

  const visibleRegistrations = showAllRegistrations ? registrations : registrations.slice(0, 8);
  const pendingSubmissions = paymentSubmissions.filter(submission => submission.status === 'submitted');
  const recentReviewedSubmissions = paymentSubmissions.filter(submission => submission.status !== 'submitted').slice(0, 4);

  const loadOverview = async () => {
    const [{ data: metricsData }, { data: churchData }, { data: registrationData }, { data: paymentData }] = await Promise.all([
      supabase.rpc('get_platform_overview_metrics'),
      supabase.rpc('get_platform_organization_summaries'),
      supabase.rpc('get_platform_recent_registrations'),
      supabase.rpc('get_platform_payment_submissions'),
    ]);

    const nextChurches = (churchData || []) as PlatformOrganizationSummary[];
    setMetrics(Array.isArray(metricsData) ? (metricsData[0] as PlatformOverviewMetrics) : (metricsData as PlatformOverviewMetrics | null));
    setChurches(nextChurches);
    setRegistrations((registrationData || []) as PlatformRecentRegistration[]);
    setPaymentSubmissions((paymentData || []) as PlatformPaymentSubmission[]);
    return nextChurches;
  };

  const loadChurchDetail = async (churchId: string) => {
    if (previewDetails[churchId]) {
      const detail = previewDetails[churchId];
      setSelectedChurch(detail);
      setChurchMembers(previewMembers[churchId] || []);
      setChurchForm({
        name: detail.name || '',
        logo_url: detail.logo_url || '',
        subscription_status: detail.subscription_status || '',
        trial_ends_at: detail.trial_ends_at ? detail.trial_ends_at.slice(0, 10) : '',
        current_period_end: detail.current_period_end ? detail.current_period_end.slice(0, 10) : '',
        seats_purchased: String(detail.seats_purchased ?? 0),
      });
      return;
    }

    const [{ data: detailData }, { data: memberData }] = await Promise.all([
      supabase.rpc('get_platform_organization_detail', { p_org_id: churchId }),
      supabase.rpc('get_platform_organization_members', { p_org_id: churchId }),
    ]);

    const detail = Array.isArray(detailData)
      ? ((detailData[0] as DashboardChurchDetail | undefined) ?? null)
      : ((detailData as DashboardChurchDetail | null) ?? null);

    setSelectedChurch(detail);
    setChurchMembers((memberData || []) as DashboardChurchMember[]);

    if (detail) {
      setChurchForm({
        name: detail.name || '',
        logo_url: detail.logo_url || '',
        subscription_status: detail.subscription_status || '',
        trial_ends_at: detail.trial_ends_at ? detail.trial_ends_at.slice(0, 10) : '',
        current_period_end: detail.current_period_end ? detail.current_period_end.slice(0, 10) : '',
        seats_purchased: String(detail.seats_purchased ?? 0),
      });
    }
  };

  useEffect(() => {
    if (!isPlatformOwner) {
      setLoading(false);
      return;
    }

    const load = async () => {
      const nextChurches = await loadOverview();
      const firstRealChurch = nextChurches[0]?.id;
      const fallbackPreview = !firstRealChurch && previewChurches[0] ? previewChurches[0].id : null;
      setSelectedChurchId(firstRealChurch || fallbackPreview);
      setLoading(false);
    };

    load();
  }, [isPlatformOwner]);

  useEffect(() => {
    if (!selectedChurchId || !isPlatformOwner) return;
    loadChurchDetail(selectedChurchId);
  }, [selectedChurchId, isPlatformOwner]);

  const handleSaveChurch = async () => {
    if (!selectedChurch || selectedChurch.isPreview) return;
    setSaving(true);
    const { error } = await supabase.rpc('update_platform_organization', {
      p_org_id: selectedChurch.id,
      p_name: churchForm.name.trim(),
      p_logo_url: churchForm.logo_url.trim() || null,
      p_subscription_status: churchForm.subscription_status || null,
      p_trial_ends_at: churchForm.trial_ends_at || null,
      p_current_period_end: churchForm.current_period_end || null,
      p_seats_purchased: Number(churchForm.seats_purchased || 0),
    });
    setSaving(false);
    if (error) {
      toast('error', error.message || 'Failed to save church changes');
      return;
    }

    const nextChurches = await loadOverview();
    const stillSelected = nextChurches.find(church => church.id === selectedChurch.id);
    if (stillSelected) {
      await loadChurchDetail(stillSelected.id);
    }
    toast('success', 'Church subscription details saved');
  };

  const openChurchModal = (churchId: string) => {
    setSelectedChurchId(churchId);
    setChurchModalOpen(true);
  };

  const handleVerifySubmission = async (submissionId: string) => {
    setReviewingSubmissionId(submissionId);
    const { error } = await supabase.rpc('review_platform_payment_submission', {
      p_submission_id: submissionId,
      p_action: 'verify',
      p_rejection_reason: null,
    });
    setReviewingSubmissionId(null);
    if (error) {
      toast('error', error.message || 'Failed to verify payment');
      return;
    }

    const nextChurches = await loadOverview();
    const stillSelected = selectedChurchId ? nextChurches.find(church => church.id === selectedChurchId) : null;
    if (stillSelected) {
      await loadChurchDetail(stillSelected.id);
    }
    toast('success', 'Payment verified and church activated');
  };

  const openRejectModal = (submission: PlatformPaymentSubmission) => {
    setSubmissionToReject(submission);
    setRejectionReason('');
    setRejectionModalOpen(true);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/platform', { replace: true });
  };

  const handleRejectSubmission = async () => {
    if (!submissionToReject || !rejectionReason.trim()) return;
    setReviewingSubmissionId(submissionToReject.id);
    const { error } = await supabase.rpc('review_platform_payment_submission', {
      p_submission_id: submissionToReject.id,
      p_action: 'reject',
      p_rejection_reason: rejectionReason.trim(),
    });
    setReviewingSubmissionId(null);
    if (error) {
      toast('error', error.message || 'Failed to reject payment');
      return;
    }

    setRejectionModalOpen(false);
    setSubmissionToReject(null);
    setRejectionReason('');

    const nextChurches = await loadOverview();
    const stillSelected = selectedChurchId ? nextChurches.find(church => church.id === selectedChurchId) : null;
    if (stillSelected) {
      await loadChurchDetail(stillSelected.id);
    }
    toast('success', 'Payment submission rejected');
  };

  if (loading) return <PageLoader />;

  if (!isPlatformOwner) {
    return (
      <div className="page-container page-bottom-pad">
        <div className="max-w-6xl mx-auto pt-6 sm:pt-8">
          <div className="card p-6 text-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Access Restricted</h1>
            <p className="text-sm text-gray-500 dark:text-white/45 mt-2">This dashboard is only for the platform owner.</p>
          </div>
        </div>
      </div>
    );
  }

  const metricCards = [
    { label: 'Churches', value: metrics?.total_churches ?? 0, helper: `${displayChurches.length} shown in preview`, icon: Building2, color: '#16a34a' },
    { label: 'Members', value: metrics?.total_members ?? 0, helper: 'Real attached members', icon: Users, color: '#0ea5e9' },
    { label: 'Org Admins', value: metrics?.total_org_admins ?? 0, helper: 'Tenant admins', icon: Shield, color: '#f59e0b' },
    { label: 'Pending Invites', value: metrics?.pending_invites ?? 0, helper: 'Awaiting acceptance', icon: UserPlus, color: '#8b5cf6' },
    { label: 'Active Subs', value: metrics?.active_subscriptions ?? 0, helper: 'Live paying churches', icon: CreditCard, color: '#10b981' },
    { label: 'Unattached Signups', value: metrics?.unattached_registrations ?? 0, helper: 'No church assigned yet', icon: CalendarClock, color: '#ef4444' },
  ];

  return (
    <div className="page-container page-bottom-pad overflow-hidden">
      <motion.div
        variants={container}
        initial="initial"
        animate="animate"
        className="max-w-2xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-5 lg:px-6 pt-6 sm:pt-8 space-y-5 sm:space-y-6"
      >
        <motion.section
          variants={item}
          className="relative overflow-hidden rounded-[2rem] border border-emerald-200/70 bg-[radial-gradient(circle_at_18%_20%,rgba(52,211,153,0.22),transparent_34%),linear-gradient(135deg,#f0fdf4_0%,#ffffff_48%,#f8fafc_100%)] p-5 shadow-[0_24px_80px_-46px_rgba(6,95,70,0.72)] dark:border-white/[0.08] dark:bg-[radial-gradient(circle_at_16%_18%,rgba(16,185,129,0.16),transparent_34%),linear-gradient(135deg,#071c14_0%,#0d1110_46%,#070807_100%)] sm:p-6"
        >
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-emerald-300/25 blur-3xl dark:bg-emerald-500/10" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-500/10" />
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/[0.09]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-70 animate-ping dark:bg-emerald-400" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                </span>
                <p className="text-[10px] font-mono font-black uppercase tracking-[0.32em] text-emerald-700/75 dark:text-emerald-300/70">
                  Platform owner <span className="mx-1.5 text-emerald-700/25 dark:text-white/20">·</span> Control plane
                </p>
              </div>
              <h1
                className="mt-3 text-[2.35rem] font-black leading-none text-gray-950 dark:text-white sm:text-[3.15rem] lg:text-[3.65rem]"
                style={{ letterSpacing: '-0.065em' }}
              >
                Platform.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-white/52">
                Cross-church visibility, church management, and onboarding oversight. Preview tenants are included below only to help you judge the layout before more real churches exist.
              </p>
            </div>

            <div className="w-full lg:w-auto space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="h-11 px-4 rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-sm font-semibold text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.08] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to App
                </button>
                <button
                  onClick={handleSignOut}
                  className="h-11 px-4 rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/[0.08] text-sm font-semibold text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/[0.14] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>

              <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/85 dark:bg-emerald-900/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                <span className="font-semibold">Owner-only:</span> preview churches never touch the real database.
              </div>
            </div>
          </div>

          <div className="relative mt-5 grid gap-2 border-t border-emerald-900/[0.07] pt-4 dark:border-white/[0.11] sm:grid-cols-3">
            {[
              { label: 'Churches', value: metrics?.total_churches ?? 0 },
              { label: 'Active subs', value: metrics?.active_subscriptions ?? 0 },
              { label: 'Payments', value: pendingSubmissions.length },
            ].map(stat => (
              <div key={stat.label} className="rounded-2xl border border-white/70 bg-white/65 px-3 py-3 text-center shadow-sm backdrop-blur dark:border-white/[0.08] dark:bg-white/[0.05]">
                <p className="text-lg font-black leading-none text-gray-950 dark:text-white">{stat.value}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-white/32">{stat.label}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={item} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
          {metricCards.map(card => (
            <motion.div
              key={card.label}
              variants={item}
              className={`${surfaceCardClass} p-4 sm:p-5`}
              style={surfaceCardStyle}
            >
              <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.05] dark:via-white/[0.08] to-transparent" />
              <div className="flex items-center justify-between mb-3">
                <div
                  className="h-10 w-10 rounded-2xl flex items-center justify-center"
                  style={{ background: `${card.color}18`, color: card.color }}
                >
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{card.value}</div>
              <div className="text-xs text-gray-500 dark:text-white/45 mt-1">{card.label}</div>
              <div className="text-[11px] text-gray-400 dark:text-white/30 mt-2">{card.helper}</div>
            </motion.div>
          ))}
        </motion.section>

        <motion.section variants={item} className="grid grid-cols-1 xl:grid-cols-[1.05fr,0.95fr] gap-5 sm:gap-6">
          <div className={`${surfaceCardClass} p-0 overflow-hidden`} style={surfaceCardStyle}>
            <div className="px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1">Billing Queue</p>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Pending Payment Reviews</h2>
                <p className="text-xs text-gray-500 dark:text-white/40 mt-1">Verify or reject church payment submissions and activate billing automatically.</p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-amber-50 dark:bg-amber-500/[0.12] text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <CreditCard className="h-5 w-5" />
              </div>
            </div>
            {pendingSubmissions.length === 0 ? (
              <div className="p-4 sm:p-5">
                <div className="rounded-3xl border border-dashed border-gray-200 dark:border-white/[0.08] p-8 text-center text-sm text-gray-500 dark:text-white/40">
                  No payments are waiting for review.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {pendingSubmissions.map(submission => (
                  <div key={submission.id} className="px-4 sm:px-5 py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{submission.church_name}</p>
                          <span className="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
                            Under Review
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-white/40 mt-1">
                          {submission.submitted_by_email || 'Unknown submitter'} • {submission.payment_channel === 'gcash' ? 'GCash' : 'Bank transfer'}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-white/40">
                          <span><strong className="text-gray-900 dark:text-white">{submission.plan_code}</strong></span>
                          <span><strong className="text-gray-900 dark:text-white">₱{Number(submission.amount).toLocaleString()}</strong></span>
                          <span>Ref no. <strong className="text-gray-900 dark:text-white">{submission.reference_number}</strong></span>
                        </div>
                        <p className="mt-2 text-xs text-gray-400 dark:text-white/30">
                          Billing code {submission.billing_reference} • Submitted {formatDate(submission.created_at)}
                        </p>
                        {submission.note && (
                          <p className="mt-2 text-xs text-gray-500 dark:text-white/40">{submission.note}</p>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                        <button
                          onClick={() => handleVerifySubmission(submission.id)}
                          disabled={reviewingSubmissionId === submission.id}
                          className="btn-primary text-sm justify-center min-w-[130px]"
                        >
                          {reviewingSubmissionId === submission.id ? <><Loader2 className="h-4 w-4 animate-spin" /> Working...</> : <><CheckCircle2 className="h-4 w-4" /> Verify</>}
                        </button>
                        <button
                          onClick={() => openRejectModal(submission)}
                          disabled={reviewingSubmissionId === submission.id}
                          className="btn-secondary text-sm justify-center min-w-[130px]"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`${surfaceCardClass} p-0 overflow-hidden`} style={surfaceCardStyle}>
            <div className="px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Billing Decisions</h2>
              <p className="text-xs text-gray-500 dark:text-white/40 mt-1">The latest verified or rejected submissions.</p>
            </div>
            {recentReviewedSubmissions.length === 0 ? (
              <div className="px-4 sm:px-5 py-8 text-center text-gray-500 dark:text-white/40">No billing decisions yet.</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {recentReviewedSubmissions.map(submission => (
                  <div key={submission.id} className="px-4 sm:px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{submission.church_name}</p>
                        <p className="text-xs text-gray-500 dark:text-white/40 mt-1">
                          {submission.submitted_by_email || 'Unknown submitter'} • Ref no. {submission.reference_number}
                        </p>
                      </div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        submission.status === 'verified'
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                          : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                      }`}>
                        {formatStatus(submission.status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-white/30 mt-2">
                      Reviewed {submission.reviewed_at ? formatDate(submission.reviewed_at) : '—'}
                    </p>
                    {submission.rejection_reason && (
                      <p className="text-xs text-red-500 dark:text-red-300 mt-2">{submission.rejection_reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.section>

        <motion.section variants={item} className="grid grid-cols-1 xl:grid-cols-[1.2fr,0.8fr] gap-5 sm:gap-6">
          <div className={`${surfaceCardClass} p-4 sm:p-5`} style={surfaceCardStyle}>
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1">Tenants</p>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Church Roster</h2>
                <p className="text-sm text-gray-500 dark:text-white/45 mt-1">Click a church to inspect members and manage tenant-level fields.</p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-emerald-50 dark:bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5" />
              </div>
            </div>

            <div className="space-y-3">
              {displayChurches.map(church => (
                <motion.button
                  key={church.id}
                  variants={item}
                  onClick={() => openChurchModal(church.id)}
                  whileTap={{ scale: 0.985 }}
                  className={`w-full text-left rounded-[26px] border px-4 py-4 sm:px-5 sm:py-[18px] transition-all duration-200 ${
                    selectedChurchId === church.id
                      ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/15 shadow-[0_10px_30px_-22px_rgba(22,163,74,0.55)]'
                      : 'border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-gray-300 dark:hover:border-white/[0.12] hover:-translate-y-px'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 h-11 w-11 shrink-0 rounded-2xl bg-emerald-50 dark:bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{church.name}</p>
                            {church.isPreview && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300">
                                <Sparkles className="h-3 w-3" /> Preview
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-gray-500 dark:text-white/35 mt-1 truncate">{church.slug}</p>
                        </div>
                        <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${statusTone(church.subscription_status)}`}>
                          {formatStatus(church.subscription_status)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-white/40">
                        <span><strong className="text-gray-900 dark:text-white">{church.member_count}</strong> members</span>
                        <span><strong className="text-gray-900 dark:text-white">{church.org_admin_count}</strong> admins</span>
                        <span><strong className="text-gray-900 dark:text-white">{church.pending_invite_count}</strong> invites</span>
                      </div>

                      <p className="mt-3 text-xs text-gray-500 dark:text-white/40">
                        {church.current_period_end
                          ? `Billing cycle ends ${formatDate(church.current_period_end)}`
                          : church.trial_ends_at
                            ? `Trial ends ${formatDate(church.trial_ends_at)}`
                            : 'No active billing cycle'}
                      </p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          <div className={`${surfaceCardClass} p-0 overflow-hidden`} style={surfaceCardStyle}>
            <div className="px-4 sm:px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Registrations</h2>
                <p className="text-xs text-gray-500 dark:text-white/40 mt-1">Compact by default so it doesn’t dominate the page.</p>
              </div>
              {registrations.length > 8 && (
                <button
                  onClick={() => setShowAllRegistrations(prev => !prev)}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  {showAllRegistrations ? 'Show Less' : `Show All (${registrations.length})`}
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {visibleRegistrations.map(registration => (
                <div key={registration.profile_id} className="px-4 sm:px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {registration.first_name || 'New User'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-white/40 truncate mt-1">{registration.email}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      registration.org_id
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                    }`}>
                      {registration.org_id ? 'Attached' : 'No Church Yet'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-white/30 mt-2">
                    {registration.org_name ? `${registration.org_name}${registration.is_org_admin ? ' • Church Admin' : ''}` : 'Waiting for invite or create-church setup'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-white/30 mt-1">
                    {registration.is_onboarded ? 'Onboarded' : 'Not onboarded'} • Joined {formatDate(registration.created_at)}
                  </p>
                </div>
              ))}
              {registrations.length === 0 && (
                <div className="px-4 sm:px-5 py-8 text-center text-gray-500 dark:text-white/40">No registrations yet.</div>
              )}
            </div>
          </div>
        </motion.section>
      </motion.div>

      <Modal
        open={churchModalOpen}
        onClose={() => setChurchModalOpen(false)}
        title={selectedChurch ? `${selectedChurch.name} Control Panel` : 'Church Details'}
        size="lg"
      >
        {!selectedChurch ? (
          <div className="rounded-3xl border border-dashed border-gray-200 dark:border-white/[0.08] p-8 text-center text-sm text-gray-500 dark:text-white/40">
            Select a church from the roster to load its details.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1">Selected Church</p>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Management Console</h2>
                <p className="text-sm text-gray-500 dark:text-white/45 mt-1">
                  {selectedChurch.isPreview
                    ? 'Preview mode only. These values are not saved to the database.'
                    : 'Update tenant metadata and tracked billing fields for the selected church.'}
                </p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-amber-50 dark:bg-amber-500/[0.12] text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5" />
              </div>
            </div>

            {selectedChurch.isPreview && (
              <div className="rounded-2xl border border-sky-200 dark:border-sky-900/40 bg-sky-50 dark:bg-sky-900/10 px-4 py-3 text-sm text-sky-700 dark:text-sky-300">
                This is preview-only sample data to help you review the layout with more churches on screen.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Church Name</label>
                <input value={churchForm.name} onChange={e => setChurchForm(prev => ({ ...prev, name: e.target.value }))} className="input-field text-sm" disabled={Boolean(selectedChurch.isPreview)} />
              </div>
              <div>
                <label className="block text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Slug</label>
                <input value={selectedChurch.slug} disabled className="input-field text-sm bg-gray-50 dark:bg-gray-800" />
              </div>
              <div>
                <label className="block text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Logo URL</label>
                <input value={churchForm.logo_url} onChange={e => setChurchForm(prev => ({ ...prev, logo_url: e.target.value }))} className="input-field text-sm" disabled={Boolean(selectedChurch.isPreview)} />
              </div>
              <div>
                <label className="block text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Seats Purchased</label>
                <input type="number" min={0} value={churchForm.seats_purchased} onChange={e => setChurchForm(prev => ({ ...prev, seats_purchased: e.target.value }))} className="input-field text-sm" disabled={Boolean(selectedChurch.isPreview)} />
              </div>
              <div>
                <label className="block text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Subscription Status</label>
                <select
                  value={churchForm.subscription_status}
                  onChange={e => {
                    const nextStatus = e.target.value;
                    setChurchForm(prev => {
                      const nextForm = { ...prev, subscription_status: nextStatus };
                      if (nextStatus === 'trialing') {
                        nextForm.trial_ends_at = format(addDays(new Date(), 10), 'yyyy-MM-dd');
                        nextForm.current_period_end = '';
                      }
                      return nextForm;
                    });
                  }}
                  className="input-field text-sm"
                  disabled={Boolean(selectedChurch.isPreview)}
                >
                  <option value="">Exempt / not active</option>
                  <option value="trialing">Trialing</option>
                  <option value="active">Active</option>
                  <option value="past_due">Past Due</option>
                  <option value="suspended">Suspended</option>
                  <option value="canceled">Canceled</option>
                  <option value="incomplete">Incomplete</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Trial Ends</label>
                <input type="date" value={churchForm.trial_ends_at} onChange={e => setChurchForm(prev => ({ ...prev, trial_ends_at: e.target.value }))} className="input-field text-sm" disabled={Boolean(selectedChurch.isPreview)} />
              </div>
              <div>
                <label className="block text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Billing Cycle Ends</label>
                <input type="date" value={churchForm.current_period_end} onChange={e => setChurchForm(prev => ({ ...prev, current_period_end: e.target.value }))} className="input-field text-sm" disabled={Boolean(selectedChurch.isPreview)} />
              </div>
              <div>
                <label className="block text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Stripe Customer</label>
                <input value={selectedChurch.stripe_customer_id || '—'} disabled className="input-field text-sm bg-gray-50 dark:bg-gray-800" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleSaveChurch} disabled={saving || !churchForm.name.trim() || Boolean(selectedChurch.isPreview)} className="btn-primary text-sm">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : 'Save Church'}
              </button>
              <p className="text-xs text-gray-400 dark:text-white/30">
                {selectedChurch.isPreview ? 'Preview rows cannot be edited.' : `Created ${formatDate(selectedChurch.created_at)}`}
              </p>
            </div>

            <div className="rounded-[28px] border border-gray-200 dark:border-white/[0.08] overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Team Members</h3>
                  <span className="text-xs font-medium text-gray-500 dark:text-white/40">
                    {churchMembers.length} {churchMembers.length === 1 ? 'member' : 'members'}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[360px] overflow-y-auto">
                {churchMembers.map(member => (
                  <div key={member.profile_id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {member.nickname || `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Member'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-white/40 truncate mt-1">{member.email}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        member.is_org_admin
                          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-white/70'
                      }`}>
                        {member.is_org_admin ? 'Org Admin' : member.ministry_status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-white/30 mt-2">
                      {member.is_onboarded ? 'Onboarded' : 'Not onboarded'} • Joined {formatDate(member.created_at)}
                    </p>
                  </div>
                ))}
                {churchMembers.length === 0 && (
                  <div className="px-5 py-8 text-center text-gray-500 dark:text-white/40">No members in this church yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={rejectionModalOpen}
        onClose={() => {
          setRejectionModalOpen(false);
          setSubmissionToReject(null);
          setRejectionReason('');
        }}
        title={submissionToReject ? `Reject ${submissionToReject.church_name} Payment` : 'Reject Payment'}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-white/45">
            Add a short reason so the church admin can understand what needs to be corrected before submitting again.
          </p>
          <textarea
            value={rejectionReason}
            onChange={e => setRejectionReason(e.target.value)}
            className="input-field text-sm min-h-[120px]"
            placeholder="Example: Please resubmit with the correct transfer reference number."
          />
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => {
                setRejectionModalOpen(false);
                setSubmissionToReject(null);
                setRejectionReason('');
              }}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectSubmission}
              disabled={!rejectionReason.trim() || reviewingSubmissionId === submissionToReject?.id}
              className="btn-primary text-sm"
            >
              {reviewingSubmissionId === submissionToReject?.id ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : 'Reject Submission'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
