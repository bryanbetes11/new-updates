import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { Modal } from './Modal';

export type ReportKind = 'user' | 'message' | 'announcement' | 'announcement_comment' | 'event_message';
export type ReportTarget = { kind: ReportKind; id: string; label: string };

const reasons = [
  ['harassment', 'Harassment or bullying'],
  ['sexual_content', 'Sexual or inappropriate content'],
  ['violence', 'Threats or violence'],
  ['spam', 'Spam or impersonation'],
  ['other', 'Something else'],
] as const;

export function ContentReportDialog({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = useState<(typeof reasons)[number][0]>('harassment');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!target || !user || !profile?.org_id || sending) return;
    setSending(true);
    const { error } = await supabase.from('content_reports').insert({
      org_id: profile.org_id,
      reporter_id: user.id,
      kind: target.kind,
      subject_id: target.id,
      reason,
      details: details.trim(),
    });
    setSending(false);
    if (error) {
      toast('error', 'Report could not be sent. Please try again.');
      return;
    }
    toast('success', 'Report sent for review');
    setReason('harassment');
    setDetails('');
    onClose();
  };

  return (
    <Modal open={Boolean(target)} onClose={onClose} title={`Report ${target?.label ?? 'content'}`} size="sm">
      <div className="space-y-4 text-gray-900 dark:text-white">
        <p className="text-sm text-gray-600 dark:text-white/60">Tell ServeSync what happened. A reviewer will check the report and take action if needed.</p>
        <label className="block text-sm font-semibold" htmlFor="content-report-reason">Reason</label>
        <select id="content-report-reason" value={reason} onChange={event => setReason(event.target.value as typeof reason)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[#1b1b1e]">
          {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label className="block text-sm font-semibold" htmlFor="content-report-details">Details (optional)</label>
        <textarea id="content-report-details" value={details} onChange={event => setDetails(event.target.value)} maxLength={1000} rows={4} placeholder="Add context that will help us review this" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[#1b1b1e]" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={sending || !user || !profile?.org_id} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{sending ? 'Sending…' : 'Send report'}</button>
        </div>
      </div>
    </Modal>
  );
}
