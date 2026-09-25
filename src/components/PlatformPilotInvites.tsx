import { useEffect, useState } from 'react';
import { Check, Copy, Loader2, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

type PilotInvite = {
  email: string;
  expires_at: string;
  claimed_at: string | null;
  created_at: string;
};

const churchLink = `${window.location.origin}/create-church`;

export function PlatformPilotInvites() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [invites, setInvites] = useState<PilotInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = async () => {
    const { data, error: loadError } = await supabase.rpc('list_platform_pilot_church_invites');
    if (loadError) setError('Could not load pilot invitations. Try again.');
    else { setInvites((data || []) as PilotInvite[]); setError(''); }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const approve = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    setSaving(true);
    setError('');
    const { error: saveError } = await supabase.rpc('approve_platform_pilot_church_invite', { p_email: normalizedEmail });
    setSaving(false);
    if (saveError) { setError(saveError.message || 'Could not approve this email.'); return; }
    setEmail('');
    await load();
    toast('success', 'Church administrator approved for seven days');
  };

  const revoke = async (target: string) => {
    setSaving(true);
    setError('');
    const { error: revokeError } = await supabase.rpc('revoke_platform_pilot_church_invite', { p_email: target });
    setSaving(false);
    setRevokeTarget(null);
    if (revokeError) { setError(revokeError.message || 'Could not revoke this invitation.'); return; }
    await load();
    toast('info', 'Unused church invitation revoked');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(churchLink);
      setCopied(true);
      toast('success', 'Church setup link copied');
      window.setTimeout(() => setCopied(false), 2500);
    } catch { setError('Copy failed. Select and copy the link below.'); }
  };

  return (
    <section className="rounded-3xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-white/[0.07] dark:bg-white/[0.025] sm:p-5" aria-labelledby="pilot-invites-title">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><UserPlus className="h-5 w-5" /></span>
        <div>
          <h2 id="pilot-invites-title" className="text-lg font-bold text-gray-950 dark:text-white">Invite a church to the pilot</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-white/50">Approve one adult administrator’s email, then share the setup link with them. No account or email is sent automatically.</p>
        </div>
      </div>

      <form onSubmit={approve} className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-xs font-semibold text-gray-600 dark:text-gray-300" htmlFor="pilot-admin-email">
          First administrator’s email
          <input id="pilot-admin-email" type="email" autoComplete="off" value={email} onChange={event => setEmail(event.target.value)} required maxLength={320} placeholder="admin@church.org" className="input-field mt-1.5 min-h-11 w-full text-sm" />
        </label>
        <button type="submit" disabled={saving || !email.trim()} className="btn-primary min-h-11 justify-center px-4 text-sm sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Approve email
        </button>
      </form>

      <div className="mt-4 rounded-2xl bg-gray-50 p-3 dark:bg-white/[0.04]">
        <p className="text-xs font-semibold text-gray-700 dark:text-white/75">Church setup link</p>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input readOnly aria-label="Church setup link" value={churchLink} onFocus={event => event.currentTarget.select()} className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-700 dark:border-white/[0.08] dark:bg-black/20 dark:text-white/70" />
          <button type="button" onClick={() => void copyLink()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 text-xs font-bold text-gray-700 dark:border-white/[0.1] dark:text-white/75">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-white/45">The administrator must use the approved email, confirm it, agree to the pilot terms, and create the church within seven days.</p>
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
      <div className="mt-5 border-t border-gray-100 pt-4 dark:border-white/[0.07]">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Approved administrators</h3>
        {loading ? <p className="mt-3 text-sm text-gray-500">Loading…</p> : invites.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-white/45">No church administrators approved yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {invites.map(invite => {
              const status = invite.claimed_at ? 'Church created' : new Date(invite.expires_at).getTime() <= Date.now() ? 'Expired' : `Expires ${new Date(invite.expires_at).toLocaleDateString()}`;
              return <li key={invite.email} className="flex flex-col gap-2 rounded-xl border border-gray-100 px-3 py-2.5 dark:border-white/[0.06] sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><p className="break-all text-sm font-semibold text-gray-900 dark:text-white">{invite.email}</p><p className="text-xs text-gray-500 dark:text-white/45">{status}</p></div>
                {!invite.claimed_at && (revokeTarget === invite.email ? (
                  <div className="flex gap-2"><button type="button" onClick={() => void revoke(invite.email)} disabled={saving} className="min-h-9 rounded-lg bg-red-600 px-3 text-xs font-bold text-white disabled:opacity-50">Confirm revoke</button><button type="button" onClick={() => setRevokeTarget(null)} className="min-h-9 rounded-lg px-3 text-xs font-bold text-gray-600 dark:text-white/70">Cancel</button></div>
                ) : <button type="button" onClick={() => setRevokeTarget(invite.email)} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg px-3 text-xs font-semibold text-red-600 dark:text-red-300"><Trash2 className="h-3.5 w-3.5" /> Revoke</button>)}
              </li>;
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
