import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { NotificationsSkeleton } from '../components/LoadingSpinner';
import { withRequestTimeout } from '../lib/requestTimeout';
import type { Notification } from '../types';
import { recordNotificationOpen } from '../lib/notificationOpenTracking';

function emptyListResponse() {
  return { data: [], error: null, count: null, status: 200, statusText: 'OK' };
}

export function Notifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      const { data } = await withRequestTimeout(
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .neq('type', 'message')
          .contains('delivery_channels', { in_app: true })
          .is('dismissed_at', null)
          .order('created_at', { ascending: false })
          .limit(50),
        emptyListResponse(),
        'Notifications list',
      );
      setNotifications(data || []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();

    if (!user) return;
    const channel = supabase
      .channel('notifications-page')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => fetchNotifications())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchNotifications, user]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    window.dispatchEvent(new Event('notifications-updated'));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false).neq('type', 'message');
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    window.dispatchEvent(new Event('notifications-updated'));
    toast('success', 'All notifications marked as read');
  };

  const clearAll = async () => {
    if (!user) return;
    await supabase.from('notifications').delete().eq('user_id', user.id).neq('type', 'message');
    setNotifications([]);
    window.dispatchEvent(new Event('notifications-updated'));
    toast('info', 'Notifications cleared');
  };

  const handleClick = (n: Notification) => {
    recordNotificationOpen(user?.id, n.id, 'page');
    markRead(n.id);
    if (n.data?.conversation_id) {
      navigate('/messages');
      window.setTimeout(() => navigate(`/messages/${n.data.conversation_id}`), 0);
      return;
    }
    if (n.data?.url) {
      navigate(n.data.url);
    } else if (n.data?.event_id) {
      navigate(`/events/${n.data.event_id}`);
    } else if (n.data?.announcement_id) {
      navigate('/announcements');
    } else if (n.data?.video_id) {
      navigate('/library');
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) return <div className="page-container"><NotificationsSkeleton /></div>;

  return (
    <div className="page-container page-bottom-pad relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[#050505] [background-image:radial-gradient(circle_at_18%_0%,rgba(34,197,94,0.12),transparent_28%),radial-gradient(circle_at_88%_6%,rgba(255,255,255,0.05),transparent_20%),linear-gradient(180deg,#121212_0%,#050505_26%,#050505_100%)]" />
      <div className="mx-auto max-w-2xl space-y-5 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-5 sm:max-w-3xl sm:px-6 sm:pt-6 lg:max-w-4xl lg:px-8 lg:pb-24 xl:max-w-5xl">
        <div className="animate-fade-in border-b border-white/[0.08] pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[2.15rem] font-black leading-none text-white sm:text-[3rem]">
                Notifications
              </h1>
              <p className="mt-2 text-[13px] font-semibold text-white/45">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
          {notifications.length > 0 && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white/[0.075] px-3.5 text-[11px] font-black text-white/70 transition-colors hover:bg-white/[0.11] hover:text-white"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Read
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white/[0.075] px-3.5 text-[11px] font-black text-white/70 transition-colors hover:bg-red-500/15 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </button>
            </div>
          )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="rounded-[0.85rem] border border-white/[0.08] bg-[#181818] px-6 py-16 text-center shadow-[0_22px_60px_-46px_rgba(0,0,0,0.95)]">
            <div className="relative mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-[0.65rem] bg-gradient-to-br from-emerald-400 via-green-800 to-black">
              <span className="absolute h-14 w-14 bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.34),transparent_32%)]" />
              <Bell className="relative h-6 w-6 text-white/90" />
            </div>
            <h2 className="mt-5 text-[20px] font-black text-white">No notifications</h2>
            <p className="mx-auto mt-2 max-w-[280px] text-[13px] font-semibold leading-6 text-white/45">
              You're all caught up. New team activity will show here.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden border-y border-white/[0.08]">
            {notifications.map((n, i) => (
              <button key={n.id} type="button" onClick={() => handleClick(n)} style={{ animationDelay: `${i * 20}ms` }} className={`flex w-full items-start gap-3 border-b border-white/[0.075] px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-white/[0.035] animate-notif-slide ${!n.is_read ? 'bg-[#22c55e]/[0.035]' : ''}`} aria-label={`${n.is_read ? '' : 'Unread: '}${n.title}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? 'bg-white/15' : 'bg-[#22c55e] shadow-[0_0_10px_rgba(34,197,94,0.7)]'}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-black leading-snug text-white">{n.title}</span>
                  <span className="mt-1 block line-clamp-2 text-[13px] font-semibold leading-5 text-white/45">{n.body}</span>
                  <span className="mt-1.5 block font-mono text-[11px] text-white/28">{format(parseISO(n.created_at), 'MMM d, yyyy · h:mm a')}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
