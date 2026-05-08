import { useMemo, useState } from 'react';
import {
  CheckCircle, AlertTriangle, XCircle, Sparkles, Lightbulb,
  ChevronDown, ChevronUp, Target, Info, TrendingUp, BookOpen,
  ArrowUpDown, RotateCcw, Flag, Heart, ChevronRight,
} from 'lucide-react';
import {
  runLiveGuidance, FORMAT_SPECS,
  type CheckerSong, type CheckerLanguage, type LiveGuidanceResult, type SongAnalysisResult,
} from '../lib/setlistCheckerEngine';
import type { ServiceFormat } from '../types';

interface LiveSetlistGuidanceProps {
  songs: CheckerSong[];
  serviceFormat: ServiceFormat;
  language: CheckerLanguage;
  onApplySuggestedOrder?: (order: CheckerSong[]) => void;
  compact?: boolean;
}

function HealthDot({ health }: { health: LiveGuidanceResult['health'] }) {
  const map = {
    excellent: 'bg-green-500',
    good: 'bg-green-400',
    fair: 'bg-amber-500',
    poor: 'bg-red-500',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${map[health]} shrink-0`} />;
}

function ScoreChip({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className={`flex flex-col items-center px-2.5 py-1.5 rounded-lg ${color}`}>
      <span className="text-lg font-bold tabular-nums leading-none">{score}</span>
      <span className="text-[9px] font-medium uppercase tracking-wider mt-0.5 opacity-70">{label}</span>
    </div>
  );
}

function SectionChip({ label, present, required, count }: {
  label: string; present: boolean; required: boolean; count: number;
}) {
  const baseClasses = 'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium';
  if (present) {
    return (
      <span className={`${baseClasses} bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300`}>
        <CheckCircle className="h-3 w-3" /> {label}
        {count > 1 && <span className="ml-0.5 opacity-60">×{count}</span>}
      </span>
    );
  }
  if (required) {
    return (
      <span className={`${baseClasses} bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800`}>
        <XCircle className="h-3 w-3" /> {label}
      </span>
    );
  }
  return (
    <span className={`${baseClasses} bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500`}>
      <span className="w-3 h-3 rounded-full border border-gray-300 dark:border-gray-600 shrink-0" /> {label}
    </span>
  );
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold tabular-nums text-gray-600 dark:text-gray-400 w-7 text-right">{score}</span>
    </div>
  );
}

function SongAnalysisCard({ analysis, songTitle, category, index }: {
  analysis: SongAnalysisResult;
  songTitle: string;
  category: string;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasIssues = analysis.theological_flags.length > 0 || analysis.category_fit !== 'good';
  const barColor = analysis.score >= 80 ? 'bg-green-500' : analysis.score >= 60 ? 'bg-amber-500' : 'bg-red-500';
  const fitMap = {
    good: { icon: CheckCircle, label: 'Well placed', color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' },
    ok: { icon: AlertTriangle, label: 'Placement ok', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' },
    poor: { icon: XCircle, label: 'Misplaced', color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20' },
  };
  const { icon: FitIcon, label: fitLabel, color: fitColor } = fitMap[analysis.category_fit];

  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span className="flex items-center justify-center h-5 w-5 rounded-md bg-gray-100 dark:bg-gray-800 text-[10px] font-medium text-gray-500 shrink-0">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{songTitle}</p>
            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-medium">{category}</span>
            {hasIssues && <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${analysis.score}%` }} />
            </div>
            <span className="text-[10px] font-bold text-gray-500 tabular-nums">{analysis.score}</span>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${fitColor}`}>
          <FitIcon className="h-2.5 w-2.5" />{fitLabel}
        </span>
        <ChevronRight className={`h-3.5 w-3.5 text-gray-400 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-100 dark:border-gray-800 pt-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-2.5 py-1.5">
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <Heart className="h-2.5 w-2.5" /> Theme
              </p>
              <p className="text-[11px] text-gray-700 dark:text-gray-300">{analysis.theological_theme}</p>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-2.5 py-1.5">
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <TrendingUp className="h-2.5 w-2.5" /> Tone
              </p>
              <p className="text-[11px] text-gray-700 dark:text-gray-300">{analysis.emotional_tone}</p>
            </div>
          </div>

          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 px-2.5 py-2">
            <p className="text-[9px] font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <CheckCircle className="h-2.5 w-2.5" /> What Works
            </p>
            <p className="text-[11px] text-green-800 dark:text-green-300 leading-relaxed">{analysis.what_works}</p>
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 px-2.5 py-2">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Info className="h-2.5 w-2.5" /> Why This Position
            </p>
            <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">{analysis.placement_reason}</p>
          </div>

          {analysis.theological_flags.length > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 px-2.5 py-2 space-y-1.5">
              <p className="text-[9px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <Flag className="h-2.5 w-2.5" /> Theological Notes
              </p>
              {analysis.theological_flags.map((f, fi) => (
                <p key={fi} className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">{f}</p>
              ))}
            </div>
          )}

          {analysis.suggested_position && (
            <div className="flex items-center gap-2 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-900/30 px-2.5 py-2">
              <ArrowUpDown className="h-3 w-3 text-brand-600 dark:text-brand-400 shrink-0" />
              <p className="text-[11px] text-brand-700 dark:text-brand-300 font-medium">{analysis.suggested_position}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function LiveSetlistGuidance({
  songs,
  serviceFormat,
  language,
  onApplySuggestedOrder,
  compact = false,
}: LiveSetlistGuidanceProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showSuggestedOrder, setShowSuggestedOrder] = useState(false);

  const guidance = useMemo(
    () => runLiveGuidance(songs, serviceFormat, language),
    [songs, serviceFormat, language],
  );

  const spec = FORMAT_SPECS[serviceFormat];

  const suggestedOrder = useMemo(() => {
    const ORDER: Record<string, number> = { Opening: 1, Praise: 2, Worship: 3, Offering: 4, Closing: 5, Special: 6, Others: 7 };
    return [...songs].sort((a, b) => (ORDER[a.category] ?? 6) - (ORDER[b.category] ?? 6)).map((s, i) => ({ ...s, position: i + 1 }));
  }, [songs]);

  const healthColors = {
    excellent: 'text-green-600 dark:text-green-400',
    good: 'text-green-500 dark:text-green-400',
    fair: 'text-amber-600 dark:text-amber-400',
    poor: 'text-red-600 dark:text-red-400',
  };
  const scoreBgColors = {
    excellent: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    good: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    fair: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
    poor: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  };

  if (songs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-brand-500" />
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Live Guidance</p>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">Add songs to start receiving live feedback on your setlist structure.</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Format: <span className="font-medium text-gray-600 dark:text-gray-300">{spec.label}</span></p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-3.5 py-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-900/60 dark:to-gray-900/40 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-brand-500" />
              <p className="text-xs font-semibold text-gray-900 dark:text-white">Live Guidance</p>
              <HealthDot health={guidance.health} />
              <span className={`text-xs font-medium ${healthColors[guidance.health]}`}>{guidance.healthLabel}</span>
            </div>
            <span className={`text-sm font-bold tabular-nums px-2 py-0.5 rounded-lg ${scoreBgColors[guidance.health]}`}>
              {guidance.overallScore}/100
            </span>
          </div>
        </div>

        <div className="px-3.5 py-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {guidance.sections.map(s => (
              <SectionChip key={s.category} label={s.label} present={s.present} required={s.required} count={s.count} />
            ))}
          </div>

          {(guidance.missingRequired.length > 0 || guidance.flowIssues.length > 0) && (
            <div className="space-y-1.5">
              {guidance.missingRequired.map(cat => (
                <div key={cat} className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 px-2.5 py-2">
                  <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-700 dark:text-red-300 leading-relaxed">
                    <strong>Missing {cat}</strong> — required for {spec.label}.{' '}
                    {guidance.sections.find(s => s.category === cat)?.recommendation}
                  </p>
                </div>
              ))}
              {guidance.flowIssues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 px-2.5 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">{issue}</p>
                </div>
              ))}
            </div>
          )}

          {guidance.missingSuggested.length > 0 && guidance.missingRequired.length === 0 && (
            <div className="space-y-1">
              {guidance.missingSuggested.map(cat => (
                <div key={cat} className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-700 dark:text-blue-300">
                    Consider adding a <strong>{cat}</strong> song — {guidance.sections.find(s => s.category === cat)?.recommendation}
                  </p>
                </div>
              ))}
            </div>
          )}

          {guidance.topSuggestion && guidance.missingRequired.length === 0 && guidance.flowIssues.length === 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 px-2.5 py-2">
              <Target className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">{guidance.topSuggestion}</p>
            </div>
          )}

          {guidance.missingRequired.length === 0 && guidance.flowIssues.length === 0 && guidance.missingSuggested.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 px-2.5 py-2">
              <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
              <p className="text-[11px] text-green-700 dark:text-green-300 font-medium">
                Set structure looks great for {spec.label}!
              </p>
            </div>
          )}
        </div>

        <div className="px-3.5 py-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3">
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400">Flow</span>
            </div>
            <ScoreBar score={guidance.flowScore} color={guidance.flowScore >= 80 ? 'bg-green-500' : guidance.flowScore >= 60 ? 'bg-amber-500' : 'bg-red-500'} />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-gray-400">Content</span>
            </div>
            <ScoreBar score={guidance.contentScore} color={guidance.contentScore >= 80 ? 'bg-green-500' : guidance.contentScore >= 60 ? 'bg-amber-500' : 'bg-red-500'} />
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowDetails(s => !s)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" /> Per-Song Analysis
        </span>
        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showDetails ? 'rotate-90' : ''}`} />
      </button>

      {showDetails && (
        <div className="space-y-2">
          {songs.map((song, i) => (
            <SongAnalysisCard
              key={song.id}
              analysis={guidance.songAnalyses[i]}
              songTitle={song.title}
              category={song.category}
              index={i}
            />
          ))}

          {suggestedOrder.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setShowSuggestedOrder(s => !s)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  {showSuggestedOrder ? 'Hide' : 'View'} Suggested Order
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showSuggestedOrder ? 'rotate-180' : ''}`} />
              </button>
              {showSuggestedOrder && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-3.5 py-3 space-y-1.5">
                  {suggestedOrder.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 w-4">{i + 1}.</span>
                      <span className="text-xs font-medium text-gray-900 dark:text-white flex-1 truncate">{s.title}</span>
                      <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">{s.category}</span>
                    </div>
                  ))}
                  {onApplySuggestedOrder && (
                    <button
                      onClick={() => { onApplySuggestedOrder(suggestedOrder); setShowSuggestedOrder(false); }}
                      className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Apply this order
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
