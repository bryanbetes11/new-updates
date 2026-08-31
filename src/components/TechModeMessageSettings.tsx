import { useState } from 'react';
import { Save, RotateCcw } from '../lib/lucide-react-proxy';
import { DEFAULT_STAGE_REQUEST_MESSAGES, DEFAULT_TECH_MODE_MESSAGES, loadStageRequestMessages, loadTechModeMessages, saveStageRequestMessages, saveTechModeMessages, TECH_MESSAGE_GROUP_LABELS, TECH_MESSAGE_GROUPS, type TechModeMessages } from '../lib/techModeMessages';

export function TechModeMessageSettings({ orgId, compact = false, onSaved }: { orgId: string; compact?: boolean; onSaved?: () => void }) {
  const [messages, setMessages] = useState<TechModeMessages>(() => loadTechModeMessages(orgId));
  const [stageRequests, setStageRequests] = useState<TechModeMessages>(() => loadStageRequestMessages(orgId));
  const [direction, setDirection] = useState<'tech' | 'stage'>('tech');
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify({ messages: loadTechModeMessages(orgId), stageRequests: loadStageRequestMessages(orgId) }));
  const activeMessages = direction === 'tech' ? messages : stageRequests;
  const setActiveMessages = direction === 'tech' ? setMessages : setStageRequests;
  const isDirty = JSON.stringify({ messages, stageRequests }) !== savedSnapshot;
  const update = (group: keyof TechModeMessages, index: number, value: string) => setActiveMessages(current => ({ ...current, [group]: current[group].map((item, itemIndex) => itemIndex === index ? value : item) }));
  const save = () => {
    if (!isDirty) return;
    saveTechModeMessages(orgId, messages);
    saveStageRequestMessages(orgId, stageRequests);
    setSavedSnapshot(JSON.stringify({ messages, stageRequests }));
    onSaved?.();
  };
  return <div className="space-y-4">
    <div className="grid grid-cols-2 rounded-xl bg-gray-100 p-1 dark:bg-white/[0.05]" role="tablist" aria-label="Message direction">
      <button type="button" role="tab" aria-selected={direction === 'tech'} onClick={() => setDirection('tech')} className={`min-h-10 rounded-lg px-3 text-xs font-black transition ${direction === 'tech' ? 'bg-white text-gray-950 shadow-sm dark:bg-white/[0.1] dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Tech → Stage</button>
      <button type="button" role="tab" aria-selected={direction === 'stage'} onClick={() => setDirection('stage')} className={`min-h-10 rounded-lg px-3 text-xs font-black transition ${direction === 'stage' ? 'bg-white text-gray-950 shadow-sm dark:bg-white/[0.1] dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>Stage → Tech</button>
    </div>
    <p className="text-xs text-gray-500 dark:text-gray-400">{direction === 'tech' ? 'Instructions the tech team can send to each stage role.' : 'Requests each stage role can send to the tech team.'}</p>
    <div className={`grid gap-3 pb-24 ${compact ? '' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
      {TECH_MESSAGE_GROUPS.map(group => <section key={group} className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-white/[0.08] dark:bg-white/[0.035]">
        <h3 className="text-xs font-black text-gray-900 dark:text-white">{TECH_MESSAGE_GROUP_LABELS[group]}</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">{activeMessages[group].map((message, index) => <input key={index} value={message} maxLength={32} aria-label={`${TECH_MESSAGE_GROUP_LABELS[group]} message ${index + 1}`} onChange={event => update(group, index, event.target.value)} className="input-field min-h-10 text-xs font-bold" />)}</div>
      </section>)}
    </div>
    <div className={`sticky bottom-0 z-20 flex min-h-16 items-center justify-end gap-2 border-t border-gray-200 bg-white py-3 shadow-[0_-12px_30px_rgba(0,0,0,0.10)] dark:border-white/[0.08] dark:bg-[#141815] dark:shadow-[0_-16px_35px_rgba(0,0,0,0.45)] ${compact ? '-mx-5 px-5' : '-mx-4 -mb-4 px-4'}`}><button type="button" onClick={() => setActiveMessages(direction === 'tech' ? DEFAULT_TECH_MODE_MESSAGES : DEFAULT_STAGE_REQUEST_MESSAGES)} className="btn-secondary inline-flex min-h-10 items-center gap-2 px-3 text-xs font-black"><RotateCcw className="h-4 w-4" />Reset</button><button type="button" disabled={!isDirty} onClick={save} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-xs font-black transition ${isDirty ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/15 hover:bg-emerald-400' : 'cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-white/[0.06] dark:text-gray-600'}`}><Save className="h-4 w-4" />Save Settings</button></div>
  </div>;
}
