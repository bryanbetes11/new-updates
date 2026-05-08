import { useState, useEffect, useRef, useCallback } from 'react';
import { format, parseISO, isToday, isYesterday, isSameDay } from 'date-fns';
import { ArrowLeft, Send, Paperclip, X, Pin, Users, MoreVertical, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Avatar } from '../../components/Avatar';
import { MessageBubble } from './MessageBubble';
import type { Message, Conversation, Profile, ConversationMember } from '../../types';

interface ChatWindowProps {
  conversation: Conversation;
  currentUserId: string;
  isLeader: boolean;
  onBack: () => void;
}

function DateDivider({ date }: { date: string }) {
  const d = parseISO(date);
  const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEEE, MMMM d');
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
      <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 px-2">{label}</span>
      <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
    </div>
  );
}

function getConvName(conv: Conversation, currentUserId: string): { name: string; subtitle: string; avatar: string | null; firstName: string; lastName: string } {
  if (conv.type === 'personal') {
    const other = conv.conversation_members?.find(m => m.user_id !== currentUserId);
    const p = other?.profiles as Profile | undefined;
    return {
      name: p ? `${p.first_name} ${p.last_name}` : conv.name || 'Direct Message',
      subtitle: 'Direct Message',
      avatar: p?.avatar_url || null,
      firstName: p?.first_name || '?',
      lastName: p?.last_name || '',
    };
  }
  if (conv.type === 'event') {
    return { name: conv.name || conv.events?.title || 'Event Chat', subtitle: 'Event Discussion', avatar: null, firstName: 'E', lastName: '' };
  }
  const memberCount = conv.conversation_members?.length || 0;
  return { name: conv.name || 'Group Chat', subtitle: `${memberCount} members`, avatar: null, firstName: conv.name?.[0] || 'G', lastName: '' };
}

export function ChatWindow({ conversation, currentUserId, isLeader, onBack }: ChatWindowProps) {
  const toast = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerText, setComposerText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { name, subtitle, avatar, firstName, lastName } = getConvName(conversation, currentUserId);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        profiles:sender_id(id, first_name, last_name, avatar_url),
        reactions:message_reactions(id, user_id, emoji, created_at),
        reply_message:reply_to(id, content, deleted_at, profiles:sender_id(first_name, last_name))
      `)
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(100);
    if (!error) {
      setMessages((data || []) as Message[]);
      const pinned = ((data || []) as Message[]).filter(m => m.is_pinned && !m.deleted_at);
      setPinnedMessages(pinned);
    }
    setLoading(false);
  }, [conversation.id]);

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase
      .from('conversation_members')
      .select('*, profiles:user_id(id, first_name, last_name, avatar_url)')
      .eq('conversation_id', conversation.id);
    setMembers((data || []) as ConversationMember[]);
  }, [conversation.id]);

  const markRead = useCallback(async () => {
    await supabase.from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversation.id)
      .eq('user_id', currentUserId);
  }, [conversation.id, currentUserId]);

  useEffect(() => {
    fetchMessages();
    fetchMembers();
    markRead();
  }, [fetchMessages, fetchMembers, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const channel = supabase.channel(`conv:${conversation.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` }, () => {
        fetchMessages();
        markRead();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` }, () => {
        fetchMessages();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, () => {
        fetchMessages();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, () => {
        fetchMessages();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversation.id, fetchMessages, markRead]);

  const sendMessage = async () => {
    const text = composerText.trim();
    if (!text || sending) return;
    setSending(true);
    const payload: Record<string, unknown> = {
      conversation_id: conversation.id,
      sender_id: currentUserId,
      content: text,
    };
    if (replyTo) payload.reply_to = replyTo.id;
    const { error } = await supabase.from('messages').insert(payload);
    if (error) { toast('error', 'Failed to send'); } else {
      setComposerText('');
      setReplyTo(null);
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    const existing = messages.find(m => m.id === messageId)?.reactions?.find(r => r.user_id === currentUserId && r.emoji === emoji);
    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: currentUserId, emoji });
    }
  };

  const handleDelete = async (messageId: string) => {
    await supabase.from('messages').update({ deleted_at: new Date().toISOString(), deleted_by: currentUserId }).eq('id', messageId);
  };

  const handlePin = async (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    await supabase.from('messages').update({ is_pinned: !msg.is_pinned, pinned_by: !msg.is_pinned ? currentUserId : null, pinned_at: !msg.is_pinned ? new Date().toISOString() : null }).eq('id', messageId);
  };

  const renderMessages = () => {
    const nodes: React.ReactNode[] = [];
    let lastDate: Date | null = null;
    let lastSenderId: string | null = null;

    messages.forEach((msg, i) => {
      const msgDate = parseISO(msg.created_at);
      if (!lastDate || !isSameDay(lastDate, msgDate)) {
        nodes.push(<DateDivider key={`date-${i}`} date={msg.created_at} />);
        lastDate = msgDate;
        lastSenderId = null;
      }
      const isOwn = msg.sender_id === currentUserId;
      const showAvatar = msg.sender_id !== lastSenderId;
      nodes.push(
        <MessageBubble
          key={msg.id}
          message={msg}
          isOwn={isOwn}
          showAvatar={showAvatar}
          onReply={setReplyTo}
          onReact={handleReact}
          onDelete={isOwn || isLeader ? handleDelete : undefined}
          onPin={isLeader ? handlePin : undefined}
          canDelete={isOwn || isLeader}
          canPin={isLeader}
          currentUserId={currentUserId}
        />
      );
      lastSenderId = msg.sender_id;
    });
    return nodes;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 bg-white dark:bg-gray-950">
        <button onClick={onBack} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors sm:hidden">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {conversation.type === 'personal' ? (
          <Avatar src={avatar} firstName={firstName} lastName={lastName} size="md" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-500 to-blue-600 flex items-center justify-center text-white shrink-0">
            <span className="text-sm font-semibold">{firstName}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        {conversation.type !== 'personal' && (
          <button
            onClick={() => setShowMembers(s => !s)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Users className="h-5 w-5" />
          </button>
        )}
      </div>

      {pinnedMessages.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/30">
          <div className="flex items-center gap-2">
            <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300 truncate flex-1">
              <span className="font-medium">Pinned:</span> {pinnedMessages[pinnedMessages.length - 1].content}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto py-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="h-6 w-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="h-14 w-14 rounded-full bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mb-3">
                {conversation.type === 'personal' ? (
                  <Avatar src={avatar} firstName={firstName} lastName={lastName} size="lg" />
                ) : (
                  <Users className="h-7 w-7 text-brand-600 dark:text-brand-400" />
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{name}</p>
              <p className="text-xs text-gray-400 mt-1">No messages yet. Say hello!</p>
            </div>
          ) : (
            <>
              {renderMessages()}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {showMembers && (
          <div className="w-60 border-l border-gray-100 dark:border-gray-800 overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Members ({members.length})</p>
              <button onClick={() => setShowMembers(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="py-2 divide-y divide-gray-50 dark:divide-gray-800/50">
              {members.map(m => {
                const p = m.profiles as Profile | undefined;
                return (
                  <div key={m.id} className="px-4 py-2.5 flex items-center gap-2.5">
                    <Avatar src={p?.avatar_url || null} firstName={p?.first_name || '?'} lastName={p?.last_name} size="sm" />
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{p?.first_name} {p?.last_name}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950">
        {replyTo && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800">
            <Reply className="h-3.5 w-3.5 text-brand-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-brand-600 dark:text-brand-400">{(replyTo.profiles as Profile | undefined)?.first_name}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{replyTo.content}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={composerText}
              onChange={e => setComposerText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-2.5 pr-12 rounded-2xl bg-gray-100 dark:bg-gray-800 border-none text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!composerText.trim() || sending}
            className="h-11 w-11 rounded-2xl bg-brand-600 hover:bg-brand-700 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white disabled:text-gray-400 flex items-center justify-center transition-colors shrink-0"
          >
            <Send className="h-4.5 w-4.5" />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-1">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
