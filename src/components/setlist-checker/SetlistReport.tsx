import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, XCircle, AlertCircle, AlertTriangle, ChevronDown, ChevronUp,
  Star, Copy, Check, ArrowLeft, RotateCcw, Send, Flag, ArrowRight,
} from 'lucide-react';
import type { SetlistCheckReport } from '../../types';

interface SetlistReportProps {
  report: SetlistCheckReport;
  onBack: () => void;
  onRecheck?: () => void;
  onSubmitProposal?: () => void;
  canSubmit: boolean;
  setlistStatus: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function VerdictIcon({ verdict, className }: { verdict: SetlistCheckReport['verdict']; className?: string }) {
  if (verdict === 'APPROVE') return <CheckCircle className={className} />;
  if (verdict === 'REVISE') return <AlertCircle className={className} />;
  return <XCircle className={className} />;
}

function verdictColors(verdict: SetlistCheckReport['verdict']) {
  if (verdict === 'APPROVE') return {
    banner: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    icon: 'text-green-600 dark:text-green-400',
    label: 'text-green-800 dark:text-green-200',
    badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    actionBorder: 'border-l-green-500',
  };
  if (verdict === 'REVISE') return {
    banner: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    icon: 'text-amber-600 dark:text-amber-400',
    label: 'text-amber-800 dark:text-amber-200',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    actionBorder: 'border-l-amber-500',
  };
  return {
    banner: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    icon: 'text-red-600 dark:text-red-400',
    label: 'text-red-800 dark:text-red-200',
    badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    actionBorder: 'border-l-red-500',
  };
}

function StarRating({ rating }: { rating: number }) {
  // rating is 2.5–5.0 → map to 0–5 filled stars
  const filled = Math.round(((rating - 2.5) / 2.5) * 5);
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < filled ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
        />
      ))}
      <span className="ml-1 text-xs font-medium text-gray-500 dark:text-gray-400">{rating.toFixed(1)}/5.0</span>
    </span>
  );
}

function SlotBadge({ slot }: { slot: string }) {
  const lower = slot.toLowerCase();
  if (lower.includes('opening')) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
      {slot}
    </span>
  );
  if (lower.includes('praise')) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
      {slot}
    </span>
  );
  if (lower.includes('closing')) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
      {slot}
    </span>
  );
  // Worship / default
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
      {slot}
    </span>
  );
}

function PriorityBadge({ tier }: { tier: string }) {
  const normalizedTier = tier.replace(/_/g, ' ');
  const lower = normalizedTier.toLowerCase();
  if (lower.includes('gospel')) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
      {normalizedTier}
    </span>
  );
  if (lower.includes('god')) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
      {normalizedTier}
    </span>
  );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
      {normalizedTier}
    </span>
  );
}

function ActionBadge({ action }: { action: string }) {
  if (action === 'APPROVED') return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
      Approved
    </span>
  );
  if (action === 'APPROVED_WITH_CAUTION') return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
      Approved
    </span>
  );
  if (action === 'NEEDS_LEADER_REVIEW') return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
      Needs Leader Review
    </span>
  );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
      Rejected
    </span>
  );
}

type QResult = 'Pass' | 'Needs Revision' | 'Fail';

function QResultBadge({ result }: { result: QResult }) {
  if (result === 'Pass') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
      <CheckCircle className="h-3 w-3" /> Pass
    </span>
  );
  if (result === 'Needs Revision') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
      <AlertCircle className="h-3 w-3" /> Fail
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
      <XCircle className="h-3 w-3" /> Fail
    </span>
  );
}

const Q_LABELS = ['Q1 Christ-exalting?', 'Q2 Theologically sound?', 'Q3 Emotionally honest?', 'Q4 Slot-appropriate?', 'Q5 Congregation-accessible?'];

// ── sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
      {children}
    </p>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function SetlistReport({
  report,
  onBack,
  onRecheck,
  onSubmitProposal,
  canSubmit,
  setlistStatus,
}: SetlistReportProps) {
  const [copied, setCopied] = useState(false);
  const [expandedSongs, setExpandedSongs] = useState<Set<number>>(new Set());
  const [showReviseWarning, setShowReviseWarning] = useState(false);

  const colors = verdictColors(report.verdict);

  const canShowSubmit =
    canSubmit &&
    ['draft', 'revision_requested'].includes(setlistStatus) &&
    report.verdict !== 'REJECT';

  const handleCopyDiscord = () => {
    navigator.clipboard.writeText(report.discordText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const toggleSong = (idx: number) => {
    setExpandedSongs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSubmitClick = () => {
    if (report.verdict === 'REVISE') {
      setShowReviseWarning(true);
    } else {
      onSubmitProposal?.();
    }
  };

  // ── action plan border color ──
  const actionPlanBorderColor =
    report.verdict === 'APPROVE'
      ? 'border-l-green-500'
      : report.verdict === 'REVISE'
      ? 'border-l-amber-500'
      : 'border-l-red-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col"
    >
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Setlist
          </button>

          {canShowSubmit && (
            <button
              onClick={handleSubmitClick}
              className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors ${
                report.verdict === 'APPROVE'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              <Send className="h-3.5 w-3.5" />
              {report.verdict === 'APPROVE' ? 'Submit Proposal' : 'Submit Anyway'}
            </button>
          )}

          {report.verdict === 'REJECT' && canSubmit && ['draft', 'revision_requested'].includes(setlistStatus) && (
            <div className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
              <XCircle className="h-3.5 w-3.5" />
              Address flagged issues before submitting.
            </div>
          )}
        </div>

        {/* Revise inline warning */}
        <AnimatePresence>
          {showReviseWarning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200"
            >
              <p className="font-medium mb-2">
                Heads up: This setlist has issues flagged. Leaders may request revisions. Are you sure?
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowReviseWarning(false)}
                  className="px-3 py-1.5 rounded-lg font-medium bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setShowReviseWarning(false); onSubmitProposal?.(); }}
                  className="px-3 py-1.5 rounded-lg font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors"
                >
                  Submit Anyway
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Body ── */}
      <div className="px-4 py-4 space-y-5">

        {/* ── Section 1: Verdict Banner ── */}
        <div className={`rounded-xl border px-4 py-4 ${colors.banner}`}>
          <div className="flex items-start gap-3 flex-wrap">
            <VerdictIcon verdict={report.verdict} className={`h-6 w-6 shrink-0 mt-0.5 ${colors.icon}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-base font-bold ${colors.label}`}>
                  {report.verdict === 'APPROVE' ? 'Approved' : report.verdict === 'REVISE' ? 'Revise' : 'Rejected'}
                </span>
                <StarRating rating={report.rating} />
              </div>
              <p className={`text-sm leading-relaxed ${colors.label} opacity-90`}>
                {report.verdictExplanation}
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleCopyDiscord}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/70 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-900/80 transition-colors border border-gray-200 dark:border-gray-700"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy for Discord'}
            </button>
          </div>
        </div>

        {/* ── Section 2: Flow Check ── */}
        <div>
          <SectionHeader>Flow Check</SectionHeader>
          <Card>
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
              {report.flowCheck.ok ? (
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              )}
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {report.flowCheck.ok
                  ? 'Gospel flow looks good.'
                  : report.flowCheck.issues.join(' · ')}
              </p>
            </div>

            {/* Acts */}
            <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {report.flowCheck.actsSummary.map((act) => (
                <div
                  key={act.act}
                  className="rounded-2xl border border-gray-200/90 dark:border-gray-800 bg-white dark:bg-gray-900 px-3.5 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                >
                  <div className="mb-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em]">
                        {act.act}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                        {act.purpose}
                      </p>
                    </div>
                    <span className={`inline-flex min-h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-center text-[10px] font-semibold leading-none ${
                      act.songTitles.length > 0
                        ? 'border border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {act.songTitles.length > 0 ? `${act.songTitles.length} song${act.songTitles.length > 1 ? 's' : ''}` : 'No songs'}
                    </span>
                  </div>
                  {act.songTitles.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-red-200 bg-red-50/70 px-3 py-2 text-xs italic text-red-500 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-400">
                      No songs assigned to this act yet.
                    </div>
                  ) : (
                    <ul className="space-y-1.5 border-t border-gray-100 dark:border-gray-800 pt-2.5">
                      {act.songTitles.map((title) => (
                        <li key={title} className="flex items-start gap-2 text-xs font-medium text-gray-800 dark:text-gray-200">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
                          <span className="min-w-0 truncate">{title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Section 3: Slot-by-Slot Fit Check ── */}
        <div>
          <SectionHeader>Slot-by-Slot Fit Check</SectionHeader>
          <div className="space-y-2">
            {report.slotFitCheck.map((item, i) => (
              <Card key={i}>
                <div className="px-4 py-3">
                  <div className="flex items-start gap-2 flex-wrap">
                    <SlotBadge slot={item.slot} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.artist}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                      <PriorityBadge tier={item.priorityTier} />
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        item.fits
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      }`}>
                        {item.fits ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {item.fits ? 'Fits' : "Doesn't Fit"}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{item.reason}</p>
                  <div className="mt-2">
                    <ActionBadge action={item.action} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* ── Section 4: Suggested Flow Correction ── */}
        {report.suggestedFlowCorrection && (
          <div>
            <SectionHeader>Suggested Flow Correction</SectionHeader>
            <Card>
              <div className="px-4 py-3 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Suggested Order</p>
                  <ol className="space-y-1">
                    {report.suggestedFlowCorrection.orderedSongs.map((song, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className="flex items-center justify-center h-5 w-5 rounded bg-gray-100 dark:bg-gray-800 text-[11px] font-medium text-gray-500 dark:text-gray-400 shrink-0">
                          {i + 1}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white flex-1 truncate">{song.title}</span>
                        <SlotBadge slot={song.slot} />
                      </li>
                    ))}
                  </ol>
                </div>
                {report.suggestedFlowCorrection.fixes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Fixes Applied</p>
                    <ul className="space-y-1">
                      {report.suggestedFlowCorrection.fixes.map((fix, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                          <ArrowRight className="h-3.5 w-3.5 text-brand-500 shrink-0 mt-0.5" />
                          {fix}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ── Section 5: Theme Alignment ── */}
        <div>
          <SectionHeader>Theme Alignment</SectionHeader>
          <Card>
            <div className="px-4 py-3 space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 italic">
                {report.themeAlignment.theme ? `"${report.themeAlignment.theme}"` : 'No service theme provided'}
              </p>

              {report.themeAlignment.skipped ? (
                <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500 dark:text-amber-400" />
                  <p>{report.themeAlignment.summary}</p>
                </div>
              ) : report.themeAlignment.strengths.length === 0 && report.themeAlignment.mismatches.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  {report.themeAlignment.summary || 'All songs align with the service theme.'}
                </div>
              ) : (
                <>
                  {report.themeAlignment.strengths.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider mb-1.5">Strengths</p>
                      <div className="space-y-1.5">
                        {report.themeAlignment.strengths.map((s, i) => (
                          <div key={i} className="flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 px-3 py-2">
                            <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-semibold text-green-800 dark:text-green-200">{s.title}</p>
                              <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">{s.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {report.themeAlignment.mismatches.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1.5">Mismatches</p>
                      <div className="space-y-1.5">
                        {report.themeAlignment.mismatches.map((m, i) => (
                          <div key={i} className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 px-3 py-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">{m.title}</p>
                              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">{m.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>

        {/* ── Section 6: Gospel-Centeredness ── */}
        <div>
          <SectionHeader>Gospel-Centeredness</SectionHeader>
          <div className="space-y-2">
            {report.gospelCenteredness.checks.map((check, i) => (
              <Card key={i}>
                <div className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    {check.passed ? (
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{check.question}</p>
                      {!check.passed && check.explanation && (
                        <p className="mt-1.5 text-xs text-red-700 dark:text-red-300 leading-relaxed bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 border border-red-100 dark:border-red-900/30">
                          {check.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* ── Section 7: Theological Safety Concerns ── */}
        <div>
          <SectionHeader>Theological Safety Concerns</SectionHeader>
          {report.theologicalFlags.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-300 font-medium">
              <CheckCircle className="h-4 w-4 shrink-0" />
              No theological concerns flagged.
            </div>
          ) : (
            <div className="space-y-2">
              {report.theologicalFlags.map((flag, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-gray-900 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-red-100 dark:border-red-900/30 flex items-center gap-2 flex-wrap bg-red-50 dark:bg-red-900/10">
                    <Flag className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
                    <p className="text-sm font-semibold text-red-800 dark:text-red-200">{flag.songTitle}</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                      {flag.flagType}
                    </span>
                  </div>
                  <div className="px-4 py-3 space-y-2.5">
                    {flag.lyricExcerpt && (
                      <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 whitespace-pre-wrap leading-relaxed border border-gray-200 dark:border-gray-700">
                        {flag.lyricExcerpt}
                      </pre>
                    )}
                    <div>
                      <p className="text-[11px] font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider mb-0.5">Concern</p>
                      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{flag.concern}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-0.5">Recommendation</p>
                      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{flag.recommendation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 8: Five-Question Test ── */}
        <div>
          <SectionHeader>Five-Question Test</SectionHeader>
          <div className="space-y-2">
            {report.fiveQuestionTest.map((song, idx) => {
              const isExpanded = expandedSongs.has(idx);
              const qs = [song.q1, song.q2, song.q3, song.q4, song.q5];
              return (
                <Card key={idx}>
                  <button
                    onClick={() => toggleSong(idx)}
                    className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{song.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{song.artist} · {song.slot}</p>
                    </div>
                    <ActionBadge action={song.decision} />
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                      : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                    }
                  </button>

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key="expanded"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                              {song.passedQuestions}/5 passed
                            </span>
                            <ActionBadge action={song.decision} />
                          </div>
                          {qs.map((q, qi) => (
                            <div key={qi} className="flex items-start gap-3">
                              <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 w-32 shrink-0 pt-0.5">
                                {Q_LABELS[qi]}
                              </span>
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <QResultBadge result={q.result} />
                                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{q.reason}</p>
                              </div>
                            </div>
                          ))}
                          {song.leaderNote && (
                            <div className="mt-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 px-3 py-2">
                              <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-0.5">Leader Note</p>
                              <p className="text-xs text-blue-800 dark:text-blue-300">{song.leaderNote}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              );
            })}
          </div>
        </div>

        {/* ── Section 9: Action Plan ── */}
        <div>
          <SectionHeader>Action Plan</SectionHeader>
          <div className="space-y-2">
            {report.actionPlan.map((item, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 border-l-4 ${actionPlanBorderColor} px-4 py-3`}
              >
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-bold text-gray-500 dark:text-gray-400 shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="pt-2 pb-4 flex items-center gap-2 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Setlist
          </button>
          <button
            onClick={onRecheck}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Recheck
          </button>
        </div>

      </div>
    </motion.div>
  );
}
