import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useAndroidAppOfferAvailable } from '../contexts/androidAppOfferContext';
import { AndroidAppBanner } from './AndroidAppBanner';
import { PushReadinessBanner } from './PushReadinessBanner';

type Prompt = 'notifications' | 'android';

type AppReminderCarouselProps = {
  mobileHeaderVisible: boolean;
  onHeightChange: (height: number) => void;
};

export function AppReminderCarousel({ mobileHeaderVisible, onHeightChange }: AppReminderCarouselProps) {
  const androidAvailable = useAndroidAppOfferAvailable();
  const { search } = useLocation();
  const preview = import.meta.env.DEV && new URLSearchParams(search).get('preview') === 'app-offer';
  const showAndroid = androidAvailable || preview;
  const [showNotifications, setShowNotifications] = useState(false);
  const [selected, setSelected] = useState<Prompt>('notifications');
  const [interacting, setInteracting] = useState(false);
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
    const measure = () => onHeightChange(slot.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    return () => observer.disconnect();
  }, [onHeightChange]);

  const leaveFocus = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteracting(false);
  };

  return (
    <section
      ref={slotRef}
      aria-label="App reminders"
      className={`fixed inset-x-0 z-40 bg-[#050505] ${mobileHeaderVisible ? 'top-[calc(3.5rem+env(safe-area-inset-top))]' : 'top-0'} ${!mobileHeaderVisible && (showNotifications || showAndroid) ? 'pt-[env(safe-area-inset-top)]' : ''} lg:left-[var(--desktop-sidebar-width)] lg:right-[env(safe-area-inset-right,0px)] lg:top-[calc(72px+env(safe-area-inset-top))] lg:pt-0`}
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setInteracting(true)}
      onBlurCapture={leaveFocus}
    >
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
  );
}
