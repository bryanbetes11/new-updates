import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Bell, Check, Volume2, VolumeX, X } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Notification } from '../types';
import { PushNotificationSetting } from './PushNotificationSetting';
import { Modal } from './Modal';
import { setInteractionSoundsEnabled } from '../lib/interactionSounds';
import { useToast } from '../contexts/ToastContext';

const PREVIEW_LIMIT = 5;

function notificationDestination(notification: Notification) {
  if (notification.data?.conversation_id) {
    return `/messages/${notification.data.conversation_id}`;
  }
  if (notification.data?.url) return notification.data.url;
  if (notification.data?.event_id) return `/events/${notification.data.event_id}`;
  if (notification.data?.announcement_id) return '/announcements';
  if (notification.data?.video_id) return '/library';
  return '/notifications';
}

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [soundMuteConfirmOpen, setSoundMuteConfirmOpen] = useState(false);
  const [mutingSounds, setMutingSounds] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ top: 72, right: 12, caretRight: 12 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setCount(0);
      setNotifications([]);
      return;
    }

    const baseFilters = () =>
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .neq('type', 'message')
        .contains('delivery_channels', { in_app: true })
        .is('dismissed_at', null);

    const [{ count: unreadCount }, { data }] = await Promise.all([
      supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .neq('type', 'message')
        .contains('delivery_channels', { in_app: true })
        .is('dismissed_at', null),
      baseFilters().order('created_at', { ascending: false }).limit(PREVIEW_LIMIT),
    ]);

    setCount(unreadCount || 0);
    setNotifications((data as Notification[] | null) || []);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    if (!user) return;

    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, fetchNotifications)
      .subscribe();

    const onRefresh = () => fetchNotifications();
    window.addEventListener('notifications-updated', onRefresh);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('notifications-updated', onRefresh);
    };
  }, [fetchNotifications, user]);

  useEffect(() => {
    if (!open) return;
    const positionPanel = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const panelWidth = Math.min(416, window.innerWidth - 24);
      const maxRight = Math.max(12, window.innerWidth - panelWidth - 12);
      const right = Math.min(
        maxRight,
        Math.max(12, Math.round(window.innerWidth - rect.right)),
      );
      const panelRightEdge = window.innerWidth - right;
      setPanelPosition({
        top: Math.round(rect.bottom + 8),
        right,
        caretRight: Math.max(
          12,
          Math.min(panelWidth - 22, Math.round(panelRightEdge - (rect.left + rect.width / 2) - 5)),
        ),
      });
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    positionPanel();
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', positionPanel);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', positionPanel);
    };
  }, [open]);

  const openPreview = async () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const panelWidth = Math.min(416, window.innerWidth - 24);
      const maxRight = Math.max(12, window.innerWidth - panelWidth - 12);
      const right = Math.min(
        maxRight,
        Math.max(12, Math.round(window.innerWidth - rect.right)),
      );
      const panelRightEdge = window.innerWidth - right;
      setPanelPosition({
        top: Math.round(rect.bottom + 8),
        right,
        caretRight: Math.max(
          12,
          Math.min(panelWidth - 22, Math.round(panelRightEdge - (rect.left + rect.width / 2) - 5)),
        ),
      });
    }
    setOpen(true);
    setLoading(true);
    await fetchNotifications();
    setLoading(false);
  };

  const goTo = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const handleNotification = async (notification: Notification) => {
    if (!notification.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
      setCount((current) => Math.max(0, current - 1));
      window.dispatchEvent(new Event('notifications-updated'));
    }
    goTo(notificationDestination(notification));
  };

  const markAllRead = async () => {
    if (!user || count === 0) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .neq('type', 'message')
      .contains('delivery_channels', { in_app: true })
      .is('dismissed_at', null);
    setCount(0);
    setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
    window.dispatchEvent(new Event('notifications-updated'));
  };

  const turnOffSounds = async () => {
    if (!user || !profile?.org_id) return;
    setMutingSounds(true);
    const { error } = await supabase.from('notification_preferences').upsert({
      user_id: user.id,
      org_id: profile.org_id,
      sound_effects_enabled: false,
    }, { onConflict: 'user_id' });
    setMutingSounds(false);
    if (error) {
      toast('error', 'Could not turn off interaction sounds');
      return;
    }
    setInteractionSoundsEnabled(false);
    setSoundMuteConfirmOpen(false);
    toast('success', 'Interaction sounds turned off');
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => open ? setOpen(false) : void openPreview()}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/[0.08] ${open ? 'bg-white/[0.08]' : ''}`}
        aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="h-5.5 w-5.5" />
        {count > 0 && (
          <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white animate-scale-in">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[110]" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-transparent"
            onClick={() => setOpen(false)}
            aria-label="Close notifications"
          />
          <span
            className="pointer-events-none fixed inset-0 backdrop-blur-[14px]"
            style={{
              WebkitMaskImage: `radial-gradient(ellipse 330px 430px at calc(100% - ${panelPosition.right + Math.min(416, window.innerWidth - 24) / 2}px) ${panelPosition.top + 260}px, black 0%, rgba(0,0,0,0.82) 42%, transparent 100%)`,
              maskImage: `radial-gradient(ellipse 330px 430px at calc(100% - ${panelPosition.right + Math.min(416, window.innerWidth - 24) / 2}px) ${panelPosition.top + 260}px, black 0%, rgba(0,0,0,0.82) 42%, transparent 100%)`,
            }}
            aria-hidden="true"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Recent notifications"
            className="absolute w-[min(26rem,calc(100vw-1.5rem))] origin-top-right animate-scale-in rounded-2xl border border-white/[0.1] text-white shadow-[0_24px_70px_-20px_rgba(0,0,0,0.9)]"
            style={{
              top: panelPosition.top,
              right: panelPosition.right,
              maxHeight: `calc(100dvh - ${panelPosition.top + 12}px)`,
            }}
          >
            <span
              className="absolute top-0 z-10 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-l border-t border-white/[0.1] bg-[#171717]"
              style={{ right: panelPosition.caretRight }}
              aria-hidden="true"
            />
            <div className="relative overflow-hidden rounded-[inherit] bg-[#171717]">
            <header className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3.5">
              <div>
                <h2 className="text-[16px] font-black">Notifications</h2>
                <p className="mt-0.5 text-[11px] font-semibold text-white/45">
                  {count > 0 ? `${count} unread` : 'You’re all caught up'}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <PushNotificationSetting surface="compact" />
                <button
                  type="button"
                  onClick={() => setSoundMuteConfirmOpen(true)}
                  className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/[0.14] text-emerald-300 transition-colors hover:bg-emerald-500/[0.22] hover:text-emerald-200"
                  aria-label="Turn off interaction sounds"
                  title="Turn off interaction sounds"
                >
                  <Volume2 className="h-4 w-4" />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400 text-gray-950 ring-2 ring-[#1b1b1f]">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  disabled={count === 0}
                  className="inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-white/[0.07] px-2.5 text-[10px] font-black text-white/65 transition-colors hover:bg-white/[0.11] hover:text-white disabled:cursor-default disabled:opacity-35"
                >
                  Read all
                </button>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white"
                aria-label="Close notifications"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="max-h-[min(55dvh,26rem)] overflow-y-auto overscroll-contain">
              {loading && notifications.length === 0 ? (
                <div className="space-y-3 p-4" aria-label="Loading notifications">
                  {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-white/[0.05]" />)}
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-white/45">
                    <Check className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-[14px] font-black">No notifications</p>
                  <p className="mt-1 text-[12px] font-semibold text-white/40">New team activity will appear here.</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void handleNotification(notification)}
                    className={`flex w-full items-start gap-3 border-b border-white/[0.07] px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-white/[0.04] ${!notification.is_read ? 'bg-[#22c55e]/[0.045]' : ''}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.is_read ? 'bg-white/15' : 'bg-[#22c55e] shadow-[0_0_10px_rgba(34,197,94,0.7)]'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-black text-white">{notification.title}</span>
                      <span className="mt-1 block line-clamp-2 text-[12px] font-semibold leading-[1.4] text-white/45">{notification.body}</span>
                      <span className="mt-1.5 block text-[10px] font-bold text-white/25">
                        {formatDistanceToNow(parseISO(notification.created_at), { addSuffix: true })}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>

            <footer className="border-t border-white/[0.08] p-3">
              <button
                type="button"
                onClick={() => goTo('/notifications')}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#22c55e] text-[12px] font-black text-black transition-colors hover:bg-[#2dd565]"
              >
                View all notifications <ArrowRight className="h-4 w-4" />
              </button>
            </footer>
            </div>
          </section>
        </div>,
        document.body,
      )}
      <Modal
        open={soundMuteConfirmOpen}
        onClose={() => { if (!mutingSounds) setSoundMuteConfirmOpen(false); }}
        title="Turn off interaction sounds?"
        headerIcon={<VolumeX className="h-4 w-4" />}
        size="sm"
        mobileView="dialog"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-gray-800 dark:text-white">
            This will mute taps, long presses, and reaction feedback on this device. You can turn them back on or choose a different level in Settings → Sounds & feedback.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => void turnOffSounds()}
              disabled={mutingSounds}
              className="min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-white/70 dark:hover:bg-white/[0.09] dark:hover:text-white/90"
            >
              {mutingSounds ? 'Turning Off…' : 'Turn Off Sounds'}
            </button>
            <button
              type="button"
              onClick={() => setSoundMuteConfirmOpen(false)}
              disabled={mutingSounds}
              className="min-h-11 rounded-xl bg-rose-600 px-4 text-sm font-black text-white transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:opacity-50"
            >
              Keep Sounds On
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
