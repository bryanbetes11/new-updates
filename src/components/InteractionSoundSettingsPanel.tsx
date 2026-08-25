import { useEffect, useState } from 'react';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  getInteractionSoundsVolume,
  playInteractionSound,
  setInteractionSoundsEnabled,
  setInteractionSoundsVolume,
} from '../lib/interactionSounds';

interface InteractionSoundSettingsPanelProps {
  setup?: boolean;
  onComplete?: () => void;
}

const DEFAULT_VOLUME = 55;
const VOLUME_LEVELS = [
  { label: 'Quiet', value: 20 },
  { label: 'Soft', value: 40 },
  { label: 'Balanced', value: 55 },
  { label: 'Louder', value: 80 },
  { label: 'Full', value: 100 },
] as const;

export function InteractionSoundSettingsPanel({ setup = false, onComplete }: InteractionSoundSettingsPanelProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void supabase
      .from('notification_preferences')
      .select('sound_effects_enabled, sound_effects_volume')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          toast('error', 'Could not load sound settings');
        } else {
          const nextEnabled = data?.sound_effects_enabled ?? true;
          const savedVolume = data?.sound_effects_volume;
          const nextVolume = Number.isFinite(savedVolume)
            ? savedVolume as number
            : Math.round(getInteractionSoundsVolume() * 100) || DEFAULT_VOLUME;
          setEnabled(nextEnabled);
          setVolume(nextVolume);
          setInteractionSoundsEnabled(nextEnabled);
          setInteractionSoundsVolume(nextVolume / 100);
        }
        setLoading(false);
      });
    return () => { active = false; };
  }, [toast, user]);

  const setPreviewVolume = (nextVolume: number) => {
    const clamped = Math.min(100, Math.max(0, nextVolume));
    setVolume(clamped);
    setInteractionSoundsVolume(clamped / 100);
  };

  const setPreviewEnabled = (nextEnabled: boolean) => {
    setEnabled(nextEnabled);
    setInteractionSoundsEnabled(nextEnabled);
  };

  const chooseVolumeLevel = (nextVolume: number) => {
    setPreviewVolume(nextVolume);
    if (enabled && nextVolume > 0) playInteractionSound('reactionLand');
  };

  const save = async () => {
    if (!user || !profile?.org_id) return;
    setSaving(true);
    const { error } = await supabase.from('notification_preferences').upsert({
      user_id: user.id,
      org_id: profile.org_id,
      sound_effects_enabled: enabled,
      sound_effects_volume: volume,
      sound_effects_configured: true,
    }, { onConflict: 'user_id' });
    setSaving(false);
    if (error) {
      toast('error', 'Could not save sound settings');
      return;
    }
    toast('success', setup ? 'Sound settings saved' : 'Sound settings updated');
    onComplete?.();
  };

  if (loading) {
    return <div className="flex min-h-44 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-emerald-500" /></div>;
  }

  return (
    <div className="space-y-5">
      {setup && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] p-4">
          <p className="text-sm font-black text-gray-950 dark:text-white">Make ServeSync feel right for you.</p>
          <p className="mt-1 text-[13px] leading-5 text-gray-800 dark:text-white">Small, low-volume cues confirm that your taps, long presses, and reactions were received—without interrupting your work.</p>
          <p className="mt-2 text-[13px] leading-5 text-gray-800 dark:text-white">Choose a comfortable level below. Each one plays a quick preview, and you can change it any time from Settings → Sounds & feedback.</p>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-black text-gray-900 dark:text-white">Interaction sounds</p>
            <p className="mt-0.5 text-xs leading-5 text-gray-500 dark:text-white/55">Subtle feedback for taps, long presses, and reactions.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setPreviewEnabled(!enabled)}
            className={`relative inline-flex h-7 w-12 shrink-0 rounded-full p-1 transition-colors ${enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-white/15'}`}
          >
            <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className={`mt-5 ${enabled ? '' : 'pointer-events-none opacity-45'}`}>
          <div className="mb-3 flex items-center justify-between text-xs font-bold text-gray-600 dark:text-white/70">
            <span className="flex items-center gap-2">{volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} Volume</span>
            <span>{volume}%</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Sound volume levels">
            {VOLUME_LEVELS.map(level => {
              const selected = volume === level.value;
              return (
                <button
                  key={level.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => chooseVolumeLevel(level.value)}
                  className={`group flex min-h-12 flex-col items-center justify-center gap-1.5 rounded-xl px-1 text-[10px] font-bold transition ${selected ? 'bg-emerald-500/[0.12] text-emerald-700 ring-1 ring-emerald-500/45 dark:text-emerald-300' : 'text-gray-500 hover:bg-gray-200/70 dark:text-white/48 dark:hover:bg-white/[0.07]'}`}
                >
                  <span className={`h-1.5 w-full max-w-8 rounded-full transition-all ${selected ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.55)]' : 'bg-gray-300 group-hover:bg-gray-400 dark:bg-white/20 dark:group-hover:bg-white/35'}`} />
                  <span>{level.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="border-t border-gray-200 pt-3 text-[11px] leading-4 text-gray-600 dark:border-white/[0.08] dark:text-white/72">
        Uses your device media output. Phone Silent switches cannot be read reliably by web apps, so turn sounds off here whenever you want ServeSync quiet.
      </p>

      <button type="button" onClick={save} disabled={saving} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-60">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {setup ? 'Save and continue' : 'Save sound settings'}
      </button>
    </div>
  );
}
