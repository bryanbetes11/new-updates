import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { AlertTriangle, CheckCircle2, Clock3, CreditCard, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function formatStatus(status: string | null | undefined) {
  if (!status) return 'Not configured';
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function bannerTone(status: string | null | undefined) {
  if (status === 'trialing') {
    return {
      wrap: 'border-sky-200 dark:border-sky-900/40 bg-sky-50 dark:bg-sky-900/10',
      text: 'text-sky-800 dark:text-sky-200',
      sub: 'text-sky-700/85 dark:text-sky-200/80',
      icon: Clock3,
    };
  }
  if (status === 'submitted') {
    return {
      wrap: 'border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10',
      text: 'text-amber-800 dark:text-amber-200',
      sub: 'text-amber-700/85 dark:text-amber-200/80',
      icon: CreditCard,
    };
  }
  if (status === 'past_due') {
    return {
      wrap: 'border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10',
      text: 'text-red-800 dark:text-red-200',
      sub: 'text-red-700/85 dark:text-red-200/80',
      icon: AlertTriangle,
    };
  }
  if (status === 'suspended') {
    return {
      wrap: 'border-red-300 dark:border-red-900/60 bg-red-100 dark:bg-red-900/15',
      text: 'text-red-900 dark:text-red-100',
      sub: 'text-red-800/85 dark:text-red-200/85',
      icon: ShieldAlert,
    };
  }
  if (status === 'active') {
    return {
      wrap: 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/10',
      text: 'text-emerald-800 dark:text-emerald-200',
      sub: 'text-emerald-700/85 dark:text-emerald-200/80',
      icon: CheckCircle2,
    };
  }
  return {
    wrap: 'border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03]',
    text: 'text-gray-900 dark:text-white',
    sub: 'text-gray-600 dark:text-white/65',
    icon: CreditCard,
  };
}

export function BillingStatusBanner() {
  const { organization, hasOrganization, isOrgAdmin, isPlatformOwner } = useAuth();
  const navigate = useNavigate();

  if (!hasOrganization || !organization || isPlatformOwner || organization.is_billing_exempt) {
    return null;
  }

  const status = organization.billing_status || organization.subscription_status;
  if (!status || status === 'active') return null;

  const tone = bannerTone(status);
  const Icon = tone.icon;
  const daysLeft = organization.trial_ends_at
    ? differenceInCalendarDays(parseISO(organization.trial_ends_at), new Date())
    : null;

  let title = formatStatus(status);
  let body = 'Your church billing needs attention.';

  if (status === 'trialing') {
    title = `Trial active${daysLeft !== null ? ` • ${Math.max(daysLeft, 0)} day${Math.max(daysLeft, 0) === 1 ? '' : 's'} left` : ''}`;
    body = organization.trial_ends_at
      ? `Your 10-day trial ends on ${format(parseISO(organization.trial_ends_at), 'MMM d, yyyy')}.`
      : 'Your church is currently in the trial period.';
  } else if (status === 'submitted') {
    title = 'Payment under review';
    body = 'Your billing submission was received and is waiting for owner approval.';
  } else if (status === 'past_due') {
    title = 'Billing past due';
    body = 'Your church needs a payment submission to stay current.';
  } else if (status === 'suspended') {
    title = 'Billing suspended';
    body = 'Your church account needs billing attention before normal access rules are tightened further.';
  }

  return (
    <div className={`rounded-[26px] border px-4 py-3 ${tone.wrap}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 shrink-0 ${tone.text}`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-bold ${tone.text}`}>{title}</p>
            <p className={`text-xs mt-1 ${tone.sub}`}>{body}</p>
          </div>
        </div>
        {isOrgAdmin && (
          <button
            onClick={() => navigate('/leadership/billing')}
            className="btn-secondary text-xs sm:text-sm justify-center shrink-0"
          >
            Open Billing
          </button>
        )}
      </div>
    </div>
  );
}
