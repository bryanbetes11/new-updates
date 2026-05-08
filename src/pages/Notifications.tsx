import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  Bell, Check, CheckCheck, Trash2,
  Music, Megaphone, MessageCircle, PlayCircle, Users,
  CalendarClock, ClipboardCheck, AlertTriangle, Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { NotificationsSkeleton } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import type { Notification } from '../types';

const typeIcons: Record<string, typeof Bell> = {
  assignment: Users,
  assignment_response: CheckCheck,
  setlist_approved: Music,
  setlist_revision: Music,
  setlist_submitted: Music,
  announcement: Megaphone,
  comment: MessageCircle,
  video: PlayCircle,
  event_reminder: CalendarClock,
  event_today_reminder: Clock,
  attendance_reminder: ClipboardCheck,
  attendance_alert: AlertTriangle,
  proposal_reminder: CalendarClock,
};

const typeColors: Record<string, string> = {
  assignment: 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400',
  assignment_response: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  setlist_approved: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  setlist_revision: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  setlist_submitted: 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400',
  announcement: 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
  comment: 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
  video: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
  event_reminder: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  event_today_reminder: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  attendance_reminder: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  attendance_alert: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  proposal_reminder: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
};

export function Notifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications(data || []);
    setLoading(false);
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
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    window.dispatchEvent(new Event('notifications-updated'));
    toast('success', 'All notifications marked as read');
  };

  const clearAll = async () => {
    if (!user) return;
    await supabase.from('notifications').delete().eq('user_id', user.id);
    setNotifications([]);
    window.dispatchEvent(new Event('notifications-updated'));
    toast('info', 'Notifications cleared');
  };

  const handleClick = (n: Notification) => {
    markRead(n.id);
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
    <div className="page-container page-bottom-pad">
      <div className="px-4 sm:px-5 lg:px-6 py-5 sm:py-6 space-y-4">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="page-header">Notifications</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          {notifications.length > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={markAllRead} className="btn-ghost text-xs">
                <CheckCheck className="h-4 w-4" /> Mark all read
              </button>
              <button onClick={clearAll} className="btn-ghost text-xs text-red-500 hover:text-red-600">
                <Trash2 className="h-4 w-4" /> Clear
              </button>
            </div>
          )}
        </div>

        {notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-8 w-8" />}
            title="No notifications"
            description="You're all caught up! New notifications will appear here."
          />
        ) : (
          <div className="space-y-2">
            {notifications.map((n, i) => {
              const Icon = typeIcons[n.type] || Bell;
              const color = typeColors[n.type] || 'bg-gray-50 dark:bg-gray-800 text-gray-500';
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{ animationDelay: `${i * 20}ms` }}
                  className={`card w-full text-left flex items-start gap-3 p-4 transition-all hover:shadow-md animate-notif-slide ${
                    !n.is_read ? 'bg-brand-50/50 dark:bg-brand-950/20 ring-brand-200/50 dark:ring-brand-800/50' : ''
                  }`}
                >
                  <div className={`flex items-center justify-center h-9 w-9 rounded-lg shrink-0 ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${!n.is_read ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                        {n.title}
                      </p>
                      {!n.is_read && <div className="h-2 w-2 rounded-full bg-brand-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
                      {format(parseISO(n.created_at), 'MMM d, yyyy -- h:mm a')}
                    </p>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={e => { e.stopPropagation(); markRead(n.id); }}
                      className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 transition-colors shrink-0"
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
