import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { MoreHorizontal, Reply, Pin, Trash2, ExternalLink, Smile } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import type { Message, Profile } from '../../types';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🙏', '🔥', '✅'];

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  onReply: (msg: Message) => void;
  onReact: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  canDelete: boolean;
  canPin: boolean;
  currentUserId: string;
}

function groupReactions(reactions: Message['reactions']) {
  if (!reactions) return [];
  const map: Record<string, { emoji: string; count: number; users: string[] }> = {};
  reactions.forEach(r => {
    if (!map[r.emoji]) map[r.emoji] = { emoji: r.emoji, count: 0, users: [] };
    map[r.emoji].count++;
    map[r.emoji].users.push(r.user_id);
  });
  return Object.values(map);
}

export function MessageBubble({ message, isOwn, showAvatar, onReply, onReact, onDelete, onPin, canDelete, canPin, currentUserId }: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const isDeleted = !!message.deleted_at;
  const reactions = groupReactions(message.reactions);
  const profile = message.profiles as Profile | undefined;
  const replyMsg = message.reply_message;

  if (isDeleted) {
    return (
      <div className={`flex items-center gap-2 px-4 py-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">This message was deleted</p>
      </div>
    );
  }

  return (
    <div
      className={`group flex items-end gap-2 px-4 py-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false); }}
    >
      {!isOwn && (
        <div className="w-8 shrink-0 mb-1">
          {showAvatar && (
            <Avatar src={profile?.avatar_url || null} firstName={profile?.first_name || '?'} lastName={profile?.last_name} size="sm" />
          )}
        </div>
      )}

      <div className={`flex flex-col max-w-[75%] sm:max-w-[60%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && showAvatar && (
          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1 ml-1">
            {profile?.first_name} {profile?.last_name}
          </p>
        )}

        {replyMsg && (
          <div className={`mb-1 px-3 py-1.5 rounded-xl text-xs border-l-2 border-brand-400 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 max-w-full ${isOwn ? 'mr-1' : 'ml-1'}`}>
            <p className="font-medium text-brand-600 dark:text-brand-400 truncate">{(replyMsg.profiles as Profile | undefined)?.first_name || 'Someone'}</p>
            <p className="truncate">{replyMsg.deleted_at ? '(deleted)' : replyMsg.content}</p>
          </div>
        )}

        {message.is_pinned && (
          <div className={`flex items-center gap-1 text-[10px] text-amber-500 mb-0.5 ${isOwn ? 'mr-1' : 'ml-1'}`}>
            <Pin className="h-2.5 w-2.5" /> Pinned
          </div>
        )}

        <div className={`relative group/bubble ${isOwn ? 'flex flex-row-reverse items-end gap-1' : 'flex flex-row items-end gap-1'}`}>
          {showActions && (
            <div className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? 'mr-1' : 'ml-1'}`}>
              <button
                onClick={() => setShowEmojiPicker(s => !s)}
                className="p-1 rounded-lg bg-white dark:bg-gray-800 shadow-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <Smile className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onReply(message)}
                className="p-1 rounded-lg bg-white dark:bg-gray-800 shadow-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <Reply className="h-3.5 w-3.5" />
              </button>
              {canPin && (
                <button
                  onClick={() => onPin?.(message.id)}
                  className="p-1 rounded-lg bg-white dark:bg-gray-800 shadow-sm text-gray-400 hover:text-amber-500 transition-colors"
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => onDelete?.(message.id)}
                  className="p-1 rounded-lg bg-white dark:bg-gray-800 shadow-sm text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {showEmojiPicker && (
            <div className={`absolute bottom-full mb-1 flex items-center gap-1 p-1.5 rounded-2xl bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 z-10 ${isOwn ? 'right-0' : 'left-0'}`}>
              {QUICK_EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => { onReact(message.id, e); setShowEmojiPicker(false); }}
                  className="text-lg hover:scale-125 transition-transform"
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          <div
            className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words ${
              isOwn
                ? 'bg-brand-600 text-white rounded-br-sm'
                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-700 rounded-bl-sm shadow-sm'
            }`}
          >
            {message.file_url && (
              <a href={message.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 mb-1.5 underline text-xs opacity-80">
                <ExternalLink className="h-3.5 w-3.5" /> Attachment
              </a>
            )}
            {message.content && <span>{message.content}</span>}
          </div>
        </div>

        {reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'mr-1 justify-end' : 'ml-1'}`}>
            {reactions.map(r => (
              <button
                key={r.emoji}
                onClick={() => onReact(message.id, r.emoji)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                  r.users.includes(currentUserId)
                    ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border border-brand-300 dark:border-brand-700'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {r.emoji} <span className="font-medium">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        <p className={`text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 ${isOwn ? 'mr-1' : 'ml-1'}`}>
          {format(parseISO(message.created_at), 'h:mm a')}
        </p>
      </div>
    </div>
  );
}
