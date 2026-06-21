import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  Bell, Check, CheckCheck, Trash2,
  Music, Megaphone, MessageCircle, PlayCircle, Users,
  CalendarClock, ClipboardCheck, AlertTriangle, Clock, ArrowLeftRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { NotificationsSkeleton } from '../components/LoadingSpinner';
import { withRequestTimeout } from '../lib/requestTimeout';
import type { Notification } from '../types';

const typeIcons: Record<string, typeof Bell> = {
  assignment: Users,
  assignment_response: CheckCheck,
  setlist_approved: Music,
  setlist_revision: Music,
  setlist_submitted: Music,
  announcement: Megaphone,
  comment: MessageCircle,
  mention: MessageCircle,
  video: PlayCircle,
  event_reminder: CalendarClock,
  event_today_reminder: Clock,
  assignment_confirmation_reminder: Clock,
  attendance_open: ClipboardCheck,
  attendance_reminder: ClipboardCheck,
  attendance_five_min_reminder: Clock,
  attendance_grace_final_reminder: AlertTriangle,
  attendance_missed_evening_reminder: ClipboardCheck,
  attendance_missed_final_reminder: AlertTriangle,
  attendance_alert: AlertTriangle,
  proposal_reminder: CalendarClock,
  proposal_overdue_alert: AlertTriangle,
  leadership_member_action_reminder: AlertTriangle,
  swap_request: ArrowLeftRight,
  swap_approved: ArrowLeftRight,
  swap_declined: ArrowLeftRight,
  sub_request: ArrowLeftRight,
  sub_approved: ArrowLeftRight,
  sub_declined: ArrowLeftRight,
};

const typeTones: Record<string, string> = {
  assignment: 'from-emerald-500/85 via-green-900 to-black',
  assignment_response: 'from-emerald-400 via-green-800 to-black',
  setlist_approved: 'from-emerald-500/85 via-teal-900 to-black',
  setlist_revision: 'from-amber-500/85 via-yellow-900 to-black',
  setlist_submitted: 'from-emerald-500/85 via-teal-900 to-black',
  announcement: 'from-amber-500/85 via-zinc-800 to-black',
  comment: 'from-sky-500/85 via-blue-900 to-black',
  mention: 'from-emerald-400 via-green-800 to-black',
  video: 'from-rose-500/85 via-pink-900 to-black',
  event_reminder: 'from-sky-500/85 via-blue-900 to-black',
  event_today_reminder: 'from-sky-400 via-cyan-900 to-black',
  assignment_confirmation_reminder: 'from-violet-500/85 via-indigo-900 to-black',
  attendance_open: 'from-emerald-500/85 via-green-900 to-black',
  attendance_reminder: 'from-orange-500/85 via-amber-900 to-black',
  attendance_five_min_reminder: 'from-orange-500/85 via-amber-900 to-black',
  attendance_grace_final_reminder: 'from-red-500/85 via-rose-900 to-black',
  attendance_missed_evening_reminder: 'from-amber-500/85 via-yellow-900 to-black',
  attendance_missed_final_reminder: 'from-red-500/85 via-rose-900 to-black',
  attendance_alert: 'from-red-500/85 via-rose-900 to-black',
  proposal_reminder: 'from-amber-500/85 via-yellow-900 to-black',
  proposal_overdue_alert: 'from-red-500/85 via-rose-900 to-black',
  leadership_member_action_reminder: 'from-fuchsia-500/80 via-slate-800 to-black',
  swap_request: 'from-cyan-500/85 via-blue-900 to-black',
  swap_approved: 'from-emerald-500/85 via-green-900 to-black',
  swap_declined: 'from-red-500/85 via-rose-900 to-black',
  sub_request: 'from-violet-500/85 via-indigo-900 to-black',
  sub_approved: 'from-emerald-500/85 via-green-900 to-black',
  sub_declined: 'from-red-500/85 via-rose-900 to-black',
};

export function Notifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
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
          .order('created_at', { ascending: false })
          .limit(50),
        { data: [], error: null },
        'Notifications list',
      );
      setNotifications(data || []);
    } finally {
      setLoading(false);
    }
  };

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
  }, [user]);

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
              <h1 className="text-[2.15rem] font-black leading-none text-white sm:text-[3rem]" style={{ letterSpacing: '-0.06em' }}>
                Notifications
              </h1>
              <p className="mt-2 text-[13px] font-semibold text-white/45">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
          {notifications.length > 0 && (
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={markAllRead}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.075] px-3 text-[11px] font-black text-white/70 transition-colors hover:bg-white/[0.11] hover:text-white"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Read
              </button>
              <button
                onClick={clearAll}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.075] px-3 text-[11px] font-black text-white/70 transition-colors hover:bg-red-500/15 hover:text-red-300"
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
            {notifications.map((n, i) => {
              const Icon = typeIcons[n.type] || Bell;
              const tone = typeTones[n.type] || 'from-zinc-300/75 via-zinc-700 to-black';
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{ animationDelay: `${i * 20}ms` }}
                  className={`group flex w-full items-start gap-3 border-b border-white/[0.075] px-0 py-3.5 text-left transition-colors last:border-b-0 hover:bg-white/[0.035] animate-notif-slide ${
                    !n.is_read ? 'bg-[#22c55e]/[0.035]' : ''
                  }`}
                >
                  <div className={`relative ml-0.5 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[0.6rem] bg-gradient-to-br ${tone} shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]`}>
                    <span className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.34),transparent_32%)]" />
                    <Icon className="relative h-5 w-5 text-white/90" strokeWidth={2.3} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-[14px] font-black leading-snug text-white">
                        {n.title}
                      </p>
                      {!n.is_read && <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#22c55e] shadow-[0_0_12px_rgba(34,197,94,0.8)]" />}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-5 text-white/45">{n.body}</p>
                    <p className="mt-1.5 text-[11px] font-mono text-white/28">
                      {format(parseISO(n.created_at), 'MMM d, yyyy · h:mm a')}
                    </p>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={e => { e.stopPropagation(); markRead(n.id); }}
                      className="mr-0.5 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/35 transition-colors hover:bg-white/[0.08] hover:text-white"
                      aria-label="Mark notification as read"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
