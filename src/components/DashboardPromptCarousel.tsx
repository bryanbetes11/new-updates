import { useEffect, useState, type FocusEvent } from 'react';
import { Pause, Play } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAndroidAppOfferAvailable } from '../contexts/androidAppOfferContext';
import { AndroidAppBanner } from './AndroidAppBanner';
import { PushReadinessBanner } from './PushReadinessBanner';

type Prompt = 'notifications' | 'android';

export function DashboardPromptCarousel() {
  const androidAvailable = useAndroidAppOfferAvailable();
  const { search } = useLocation();
  const preview = import.meta.env.DEV && new URLSearchParams(search).get('preview') === 'app-offer';
  const showAndroid = androidAvailable || preview;
  const [showNotifications, setShowNotifications] = useState(false);
  const [selected, setSelected] = useState<Prompt>('notifications');
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const both = showNotifications && showAndroid;
  const active: Prompt = both ? selected : showNotifications ? 'notifications' : 'android';

  useEffect(() => {
    if (showNotifications) setSelected('notifications');
  }, [showNotifications]);

  useEffect(() => {
    if (!both || paused || interacting) return;
    const interval = window.setInterval(() => {
      setSelected(current => current === 'notifications' ? 'android' : 'notifications');
    }, 7000);
    return () => window.clearInterval(interval);
  }, [both, paused, interacting]);

  const leaveFocus = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteracting(false);
  };

  return (
    <section aria-label="App reminders" onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)} onFocusCapture={() => setInteracting(true)} onBlurCapture={leaveFocus}>
      <div className="grid overflow-hidden">
        <div aria-hidden={active !== 'notifications'} className={`col-start-1 row-start-1 min-w-0 transition-[transform,opacity,visibility] duration-500 motion-reduce:transition-none ${active === 'notifications' ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-full opacity-0'}`}>
          <PushReadinessBanner onVisibilityChange={setShowNotifications} />
        </div>
        {showAndroid && (
          <div aria-hidden={active !== 'android'} className={`col-start-1 row-start-1 min-w-0 transition-[transform,opacity,visibility] duration-500 motion-reduce:transition-none ${active === 'android' ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-full opacity-0'}`}>
            <AndroidAppBanner />
          </div>
        )}
      </div>
      {both && (
        <div className="flex h-7 items-center justify-center gap-2 lg:mx-[30px]" role="group" aria-label="Reminder controls">
          <button type="button" aria-label="Show notification reminder" aria-pressed={active === 'notifications'} onClick={() => setSelected('notifications')} className={`h-2.5 rounded-full transition-all ${active === 'notifications' ? 'w-5 bg-red-400' : 'w-2.5 bg-white/35'}`} />
          <button type="button" aria-label="Show Android app reminder" aria-pressed={active === 'android'} onClick={() => setSelected('android')} className={`h-2.5 rounded-full transition-all ${active === 'android' ? 'w-5 bg-emerald-400' : 'w-2.5 bg-white/35'}`} />
          <button type="button" aria-label={paused ? 'Resume reminder rotation' : 'Pause reminder rotation'} onClick={() => setPaused(value => !value)} className="ml-1 grid h-7 w-7 place-items-center rounded-full text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            {paused ? <Play aria-hidden="true" className="h-3.5 w-3.5" /> : <Pause aria-hidden="true" className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </section>
  );
}
