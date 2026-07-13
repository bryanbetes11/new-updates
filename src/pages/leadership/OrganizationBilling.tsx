import { useCallback, useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { AlertCircle, Building2, CheckCircle2, Clock3, Copy, CreditCard, Loader2, Smartphone } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { EmptyState } from '../../components/EmptyState';
import { PageLoader } from '../../components/LoadingSpinner';
import type { OrganizationPaymentSubmission } from '../../types';

type BillingPlan = {
  code: string;
  name: string;
  price: number;
  interval: 'monthly' | 'quarterly' | 'annual';
  seats: number;
  blurb: string;
};

const BILLING_PLANS: BillingPlan[] = [
  {
    code: 'starter_monthly',
    name: 'Starter Monthly',
    price: 1290,
    interval: 'monthly',
    seats: 15,
    blurb: 'Best for a single worship team that wants simple monthly billing.',
  },
  {
    code: 'team_quarterly',
    name: 'Team Quarterly',
    price: 3480,
    interval: 'quarterly',
    seats: 30,
    blurb: 'Lower friction for churches that prefer fewer payment check-ins.',
  },
  {
    code: 'church_annual',
    name: 'Church Annual',
    price: 12900,
    interval: 'annual',
    seats: 60,
    blurb: 'Best value for established teams that want one annual renewal.',
  },
];

const PAYMENT_DETAILS = {
  gcashName: 'Update to your GCash name',
  gcashNumber: '09XX XXX XXXX',
  bankName: 'Update to your bank',
  bankAccountName: 'Update to your account name',
  bankAccountNumber: 'XXXX-XXXX-XXXX',
};

function peso(value: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatBillingStatus(status: string | null | undefined) {
  if (!status) return 'Not configured';
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatPlanCode(planCode: string | null | undefined) {
  if (!planCode) return 'Not selected';
  const match = BILLING_PLANS.find(plan => plan.code === planCode);
  if (match) return match.name;
  return planCode.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function billingTone(status: string | null | undefined) {
  if (status === 'active') return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300';
  if (status === 'trialing') return 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300';
  if (status === 'submitted') return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300';
  if (status === 'past_due' || status === 'suspended') return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300';
  if (status === 'exempt') return 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300';
  return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-white/70';
}

function submissionTone(status: OrganizationPaymentSubmission['status']) {
  if (status === 'verified') return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300';
  if (status === 'rejected') return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300';
  return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300';
}

function generateBillingReference(slug: string, planCode: string) {
  const root = slug.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8) || 'CHURCH';
  const plan = planCode.split('_')[0].toUpperCase();
  const stamp = format(new Date(), 'yyyyMM');
  const nonce = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${root}-${plan}-${stamp}-${nonce}`;
}

export function OrganizationBilling() {
  const { user, organization, isOrgAdmin, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPlanCode, setSelectedPlanCode] = useState('starter_monthly');
  const [paymentChannel, setPaymentChannel] = useState<'gcash' | 'bank_transfer'>('gcash');
  const [billingReference, setBillingReference] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [payerName, setPayerName] = useState('');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<OrganizationPaymentSubmission[]>([]);

  const selectedPlan = useMemo(
    () => BILLING_PLANS.find(plan => plan.code === selectedPlanCode) || BILLING_PLANS[0],
    [selectedPlanCode],
  );

  const daysLeft = useMemo(() => {
    if (!organization?.trial_ends_at) return null;
    return differenceInCalendarDays(parseISO(organization.trial_ends_at), new Date());
  }, [organization?.trial_ends_at]);

  const fetchHistory = useCallback(async () => {
    if (!organization?.id) {
      setHistory([]);
      return;
    }

    const { data, error } = await supabase
      .from('organization_payment_submissions')
      .select('*')
      .eq('org_id', organization.id)
      .order('created_at', { ascending: false })
      .limit(8);

    if (error) {
      toast('error', 'Failed to load billing history');
      return;
    }

    setHistory((data || []) as OrganizationPaymentSubmission[]);
  }, [organization?.id, toast]);

  useEffect(() => {
    if (!organization) {
      setLoading(false);
      return;
    }

    setSelectedPlanCode(organization.billing_plan || 'starter_monthly');
    setPaymentChannel(organization.payment_method === 'manual_bank_transfer' ? 'bank_transfer' : 'gcash');
    setBillingReference(generateBillingReference(organization.slug, organization.billing_plan || 'starter_monthly'));
    fetchHistory().finally(() => setLoading(false));
  }, [fetchHistory, organization]);

  useEffect(() => {
    if (!organization) return;
    setBillingReference(generateBillingReference(organization.slug, selectedPlanCode));
  }, [organization, selectedPlanCode]);

  const latestSubmission = history[0];
  const orgStatus = organization?.billing_status || organization?.subscription_status;
  const trialDaysLeft = daysLeft === null ? null : Math.max(daysLeft, 0);
  const showTrialFields = orgStatus === 'trialing' && trialDaysLeft !== null;
  const lockedFromRedirect = searchParams.get('locked') === '1';
  const billingIntro = (() => {
    if (!organization) return '';
    if (organization.is_billing_exempt) {
      return 'MCJC is marked billing-exempt, so this church does not need payment submissions or plan renewals.';
    }
    if (orgStatus === 'submitted') {
      return 'Your latest payment reference is under review. You can monitor the submission history below while access remains available.';
    }
    if (orgStatus === 'past_due') {
      return 'Your church is now past due. Submit one payment reference below so the subscription can return to active after review.';
    }
    if (orgStatus === 'suspended') {
      return 'Billing is suspended for this church. Submit or resolve payment here to restore normal access.';
    }
    if (orgStatus === 'active') {
      return 'Your church subscription is active. Use this page to review the current plan and submit the next payment when renewal is due.';
    }
    return 'Your church keeps full access during the 10-day trial. When you are ready, submit one payment reference and we handle the review on our side.';
  })();

  const handleCopyReference = async () => {
    try {
      await navigator.clipboard.writeText(billingReference);
      toast('success', 'Billing reference copied');
    } catch {
      toast('error', 'Failed to copy billing reference');
    }
  };

  const handleSubmitPayment = async () => {
    if (!organization?.id) return;
    if (organization.is_billing_exempt) {
      toast('info', 'This church is billing-exempt, so payment submission is not needed.');
      return;
    }
    if (!referenceNumber.trim()) {
      toast('error', 'Reference number is required');
      return;
    }

    setSubmitting(true);

    const paymentMethod = paymentChannel === 'gcash' ? 'manual_gcash' : 'manual_bank_transfer';

    const { error: orgError } = await supabase
      .from('organizations')
      .update({
        billing_plan: selectedPlan.code,
        billing_interval: selectedPlan.interval,
        payment_method: paymentMethod,
        billing_status: organization.is_billing_exempt ? 'exempt' : 'submitted',
        seats_purchased: selectedPlan.seats,
      })
      .eq('id', organization.id);

    if (orgError) {
      setSubmitting(false);
      toast('error', 'Failed to update billing plan');
      return;
    }

    const { error: submissionError } = await supabase
      .from('organization_payment_submissions')
      .insert({
        org_id: organization.id,
        submitted_by: user?.id,
        plan_code: selectedPlan.code,
        amount: selectedPlan.price,
        billing_reference: billingReference,
        payer_name: payerName.trim() || null,
        payment_channel: paymentChannel,
        reference_number: referenceNumber.trim(),
        note: note.trim() || null,
      });

    setSubmitting(false);

    if (submissionError) {
      toast('error', 'Failed to submit payment details');
      return;
    }

    setReferenceNumber('');
    setPayerName('');
    setNote('');
    await refreshProfile();
    await fetchHistory();
    toast('success', 'Payment submitted for review');
  };

  if (loading) return <PageLoader />;

  if (!isOrgAdmin || !organization) {
    return (
      <div className="page-container page-bottom-pad">
        <div className="max-w-5xl mx-auto px-1 sm:px-2 pt-6 sm:pt-8">
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="text-center">
              <div
                className="relative h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'linear-gradient(145deg, #94a3b8, #64748b)', boxShadow: '0 4px 14px rgba(100,116,139,0.25)' }}
              >
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.02em' }}>Access Restricted</h2>
              <p className="text-sm text-gray-500 dark:text-white/45 mt-1">Only church admins can manage billing.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const content = (
    <div className="space-y-5 sm:space-y-6">
      {lockedFromRedirect && orgStatus === 'suspended' && (
        <div className="rounded-[26px] border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 px-4 py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-300 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-800 dark:text-red-200">Church access is currently suspended</p>
              <p className="text-sm text-red-700/85 dark:text-red-200/80 mt-1">
                Normal workspace access is limited until billing is resolved. Review the status below or submit a new payment reference to restore access.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card p-5 sm:p-6 overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none opacity-[0.08]" style={{ background: 'radial-gradient(circle at top right, #10b981, transparent 40%), radial-gradient(circle at bottom left, #0ea5e9, transparent 30%)' }} />
        <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1">Billing</p>
            <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Manual billing, premium flow.</h2>
            <p className="text-sm text-gray-500 dark:text-white/45 mt-2">
              {billingIntro}
            </p>
          </div>
          <div className="rounded-3xl border border-gray-200 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.03] px-4 py-4 min-w-[240px]">
            <div className="flex items-center justify-between gap-3">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${billingTone(organization.billing_status || organization.subscription_status)}`}>
                {formatBillingStatus(organization.billing_status || organization.subscription_status)}
              </span>
              {organization.is_billing_exempt && (
                <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300">
                  Exempt
                </span>
              )}
            </div>
            <div className="mt-4 space-y-2 text-sm">
              {showTrialFields ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-500 dark:text-white/45">Trial Ends</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {organization.trial_ends_at ? format(parseISO(organization.trial_ends_at), 'MMM d, yyyy') : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-500 dark:text-white/45">Days Left</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {`${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'}`}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500 dark:text-white/45">Billing Status</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatBillingStatus(orgStatus)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500 dark:text-white/45">Current Plan</span>
                <span className="font-semibold text-gray-900 dark:text-white">{formatPlanCode(organization.billing_plan)}</span>
              </div>
              {!showTrialFields && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500 dark:text-white/45">Current Period</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {organization.current_period_end ? format(parseISO(organization.current_period_end), 'MMM d, yyyy') : '—'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr,0.95fr] gap-5">
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1">Step 1</p>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Choose a plan</h3>
                <p className="text-sm text-gray-500 dark:text-white/45 mt-1">These plan amounts can be updated later as you finalize your pricing.</p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-emerald-50 dark:bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5" />
              </div>
            </div>

            <div className="space-y-3">
              {BILLING_PLANS.map(plan => {
                const active = selectedPlan.code === plan.code;
                return (
                  <button
                    key={plan.code}
                    type="button"
                    onClick={() => setSelectedPlanCode(plan.code)}
                    className={`w-full text-left rounded-[26px] border p-4 transition-all ${
                      active
                        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/15'
                        : 'border-gray-200 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.14]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{plan.name}</p>
                        <p className="text-xs text-gray-500 dark:text-white/40 mt-1">{plan.blurb}</p>
                      </div>
                      <div className="sm:text-right">
                        <div className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{peso(plan.price)}</div>
                        <div className="text-xs text-gray-500 dark:text-white/40 mt-1 capitalize">{plan.interval} • up to {plan.seats} seats</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1">Step 2</p>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Send your payment</h3>
                <p className="text-sm text-gray-500 dark:text-white/45 mt-1">Pay using GCash or bank transfer, then submit the payment reference once.</p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-sky-50 dark:bg-sky-500/[0.12] text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Smartphone className="h-5 w-5" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <button
                type="button"
                onClick={() => setPaymentChannel('gcash')}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  paymentChannel === 'gcash'
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/15'
                    : 'border-gray-200 dark:border-white/[0.08]'
                }`}
              >
                <p className="text-sm font-bold text-gray-900 dark:text-white">GCash</p>
                <p className="text-xs text-gray-500 dark:text-white/40 mt-1">{PAYMENT_DETAILS.gcashName}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-3">{PAYMENT_DETAILS.gcashNumber}</p>
              </button>
              <button
                type="button"
                onClick={() => setPaymentChannel('bank_transfer')}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  paymentChannel === 'bank_transfer'
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/15'
                    : 'border-gray-200 dark:border-white/[0.08]'
                }`}
              >
                <p className="text-sm font-bold text-gray-900 dark:text-white">Bank Transfer</p>
                <p className="text-xs text-gray-500 dark:text-white/40 mt-1">{PAYMENT_DETAILS.bankName}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-3">{PAYMENT_DETAILS.bankAccountNumber}</p>
                <p className="text-xs text-gray-500 dark:text-white/40 mt-1">{PAYMENT_DETAILS.bankAccountName}</p>
              </button>
            </div>

            <div className="rounded-[26px] border border-gray-200 dark:border-white/[0.08] bg-gray-50/80 dark:bg-white/[0.02] p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35">Exact amount</p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight mt-1">{peso(selectedPlan.price)}</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35">Billing reference</p>
                  <div className="mt-1 flex items-center gap-2 sm:justify-end">
                    <code className="rounded-xl bg-white dark:bg-[#171719] px-3 py-2 text-xs font-semibold text-gray-900 dark:text-white ring-1 ring-black/[0.06] dark:ring-white/[0.08]">
                      {billingReference}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyReference}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-white dark:hover:bg-white/[0.06]"
                      aria-label="Copy billing reference"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300 flex items-start gap-3">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <p>
                  Include the billing reference in your transfer note if possible. If not, just submit your payment reference number below and we will verify it from our side.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1">Step 3</p>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Submit payment</h3>
                <p className="text-sm text-gray-500 dark:text-white/45 mt-1">Only the reference number is required. Receipt uploads can stay optional for later.</p>
              </div>
              <div className="h-11 w-11 rounded-2xl bg-amber-50 dark:bg-amber-500/[0.12] text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <CreditCard className="h-5 w-5" />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="billing-reference-number" className="block text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Reference Number</label>
                <input
                  id="billing-reference-number"
                  type="text"
                  value={referenceNumber}
                  onChange={e => setReferenceNumber(e.target.value)}
                  className="input-field min-h-11 text-sm"
                  placeholder="Enter the transaction or reference number"
                />
              </div>

              <div>
                <label htmlFor="billing-payer-name" className="block text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Payer Name <span className="font-normal text-gray-400">(optional)</span></label>
                <input
                  id="billing-payer-name"
                  type="text"
                  value={payerName}
                  onChange={e => setPayerName(e.target.value)}
                  className="input-field min-h-11 text-sm"
                  placeholder="Name shown in the payment app"
                />
              </div>

              <div>
                <label htmlFor="billing-note" className="block text-[11px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1.5">Note <span className="font-normal text-gray-400">(optional)</span></label>
                <textarea
                  id="billing-note"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="input-field text-sm min-h-[96px]"
                  placeholder="Any short note that helps us match the payment"
                />
              </div>

              <button onClick={handleSubmitPayment} disabled={submitting || !referenceNumber.trim() || organization.is_billing_exempt} className="btn-primary min-h-11 w-full justify-center text-sm">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : 'I’ve Sent Payment'}
              </button>

              {organization.is_billing_exempt && (
                <div className="rounded-2xl border border-violet-200 dark:border-violet-900/40 bg-violet-50 dark:bg-violet-900/10 px-4 py-3 text-sm text-violet-700 dark:text-violet-300">
                  This church is marked billing-exempt, so payment submission is disabled.
                </div>
              )}
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Submission History</h3>
                <p className="text-xs text-gray-500 dark:text-white/40 mt-1">
                  {latestSubmission?.status === 'submitted' ? 'Your latest payment is under review.' : 'Recent payment submissions for this church.'}
                </p>
              </div>
              {latestSubmission?.status === 'submitted' && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
                  <Clock3 className="h-3.5 w-3.5" /> Under Review
                </span>
              )}
            </div>

            {history.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<CheckCircle2 className="h-6 w-6" />}
                  title="No submissions yet"
                  description="Once you submit a payment reference, it will appear here with its review status."
                />
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {history.map(item => {
                  const plan = BILLING_PLANS.find(planOption => planOption.code === item.plan_code);
                  return (
                    <div key={item.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {plan?.name || item.plan_code}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-white/40 mt-1">
                            {peso(item.amount)} • {item.payment_channel === 'gcash' ? 'GCash' : 'Bank transfer'}
                          </p>
                        </div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${submissionTone(item.status)}`}>
                          {formatBillingStatus(item.status)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-white/30 mt-2">
                        Ref no. {item.reference_number} • Billing code {item.billing_reference}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-white/30 mt-1">
                        Submitted {format(parseISO(item.created_at), 'MMM d, yyyy • h:mm a')}
                      </p>
                      {item.rejection_reason && (
                        <p className="text-xs text-red-500 dark:text-red-300 mt-2">{item.rejection_reason}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-container page-bottom-pad">
      <div className="max-w-5xl mx-auto px-1 sm:px-2 pt-6 sm:pt-8">
        {content}
      </div>
    </div>
  );
}
