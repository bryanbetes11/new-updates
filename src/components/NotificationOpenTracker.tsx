import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { consumePushNotificationOpen, flushNotificationOpens } from '../lib/notificationOpenTracking';

export function NotificationOpenTracker() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const resume = () => { consumePushNotificationOpen(user.id); void flushNotificationOpens(user.id); };
    resume();
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => { window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume); };
  }, [user]);
  return null;
}
