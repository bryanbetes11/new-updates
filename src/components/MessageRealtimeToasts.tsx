import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

type MessageInsert = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
};

function previewMessage(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (parsed?.type === 'image') return 'Sent a photo';
  } catch {
    // Plain text message.
  }

  const trimmed = content.trim();
  return trimmed.length > 72 ? `${trimmed.slice(0, 72)}...` : trimmed;
}

export function MessageRealtimeToasts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location.pathname);
  const shownIds = useRef(new Set<string>());

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`message-toasts-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, async ({ new: payload }) => {
        const message = payload as MessageInsert;
        if (!message?.id || message.sender_id === user.id || shownIds.current.has(message.id)) return;
        if (locationRef.current === `/messages/${message.conversation_id}`) return;

        const { data: membership } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('conversation_id', message.conversation_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!membership) return;

        const [{ data: sender }, { data: conversation }] = await Promise.all([
          supabase
            .from('profiles')
            .select('first_name, last_name, nickname')
            .eq('id', message.sender_id)
            .maybeSingle(),
          supabase
            .from('conversations')
            .select('name, type')
            .eq('id', message.conversation_id)
            .maybeSingle(),
        ]);

        shownIds.current.add(message.id);
        const senderName = sender?.nickname || sender?.first_name || 'New message';
        const conversationName = conversation?.name ? ` in ${conversation.name}` : '';
        toast('info', `${senderName}${conversationName}: ${previewMessage(message.content)}`, {
          actionLabel: 'Tap to open messages',
          onClick: () => navigate(`/messages/${message.conversation_id}`),
        });
        window.dispatchEvent(new Event('notifications-updated'));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate, toast, user?.id]);

  return null;
}
