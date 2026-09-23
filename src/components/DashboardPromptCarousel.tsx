import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent } from 'react';
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
  const [interacting, setInteracting] = useState(false);
  const [slotHeight, setSlotHeight] = useState(0);
  const slotRef = useRef<HTMLElement>(null);
  const both = showNotifications && showAndroid;
  const active: Prompt = both ? selected : showNotifications ? 'notifications' : 'android';

  useEffect(() => {
    if (showNotifications) setSelected('notifications');
  }, [showNotifications]);

  useEffect(() => {
    if (!both || interacting) return;
    const interval = window.setInterval(() => {
      setSelected(current => current === 'notifications' ? 'android' : 'notifications');
    }, 7000);
    return () => window.clearInterval(interval);
  }, [both, interacting]);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const measure = () => setSlotHeight(slot.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    return () => observer.disconnect();
  }, []);

  const leaveFocus = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteracting(false);
  };

  return (
    <>
      <div aria-hidden="true" className="lg:hidden" style={{ height: slotHeight }} />
      <section ref={slotRef} aria-label="App reminders" className="fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-40 bg-[#050505] lg:static" onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)} onFocusCapture={() => setInteracting(true)} onBlurCapture={leaveFocus}>
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
      </section>
    </>
  );
}
