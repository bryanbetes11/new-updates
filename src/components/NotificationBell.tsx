import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const fetchCount = async () => {
      const { count: c } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .neq('type', 'message');
      setCount(c || 0);
    };

    fetchCount();

    const channel = supabase
      .channel('notifications-count')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchCount();
      })
      .subscribe();

    const onRefresh = () => fetchCount();
    window.addEventListener('notifications-updated', onRefresh);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('notifications-updated', onRefresh);
    };
  }, [user]);

  return (
    <button
      onClick={() => navigate('/notifications')}
      className="relative p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-scale-in">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
