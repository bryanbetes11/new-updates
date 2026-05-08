import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { MessageSquare, Users, Calendar, Plus, Search } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import type { Conversation, Profile } from '../../types';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  currentUserId: string;
  unreadMap: Record<string, number>;
  search: string;
  onSearchChange: (v: string) => void;
}

function formatConvTime(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

function getConvIcon(type: string) {
  if (type === 'event') return <Calendar className="h-4 w-4" />;
  if (type === 'group') return <Users className="h-4 w-4" />;
  return null;
}

function getConvLabel(conv: Conversation, currentUserId: string): { name: string; avatar: string | null; firstName: string; lastName: string } {
  if (conv.type === 'personal') {
    const other = conv.conversation_members?.find(m => m.user_id !== currentUserId);
    const p = other?.profiles as Profile | undefined;
    return {
      name: p ? `${p.first_name} ${p.last_name}` : conv.name || 'Direct Message',
      avatar: p?.avatar_url || null,
      firstName: p?.first_name || '?',
      lastName: p?.last_name || '',
    };
  }
  return { name: conv.name || (conv.type === 'event' ? conv.events?.title || 'Event Chat' : 'Group'), avatar: null, firstName: conv.name?.[0] || 'G', lastName: '' };
}

export function ConversationList({ conversations, selectedId, onSelect, onNew, currentUserId, unreadMap, search, onSearchChange }: ConversationListProps) {
  const filtered = conversations.filter(c => {
    const label = getConvLabel(c, currentUserId);
    return label.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="flex-1 text-base font-semibold text-gray-900 dark:text-white">Messages</h2>
          <button
            onClick={onNew}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="input-field pl-9 text-sm py-2"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <MessageSquare className="h-10 w-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-400">{search ? 'No conversations found' : 'No conversations yet'}</p>
          </div>
        ) : filtered.map(conv => {
          const label = getConvLabel(conv, currentUserId);
          const unread = unreadMap[conv.id] || 0;
          const lastMsg = conv.latest_message;
          const isSelected = conv.id === selectedId;
          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors border-b border-gray-50 dark:border-gray-800/50 ${isSelected ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
            >
              <div className="relative shrink-0">
                {conv.type === 'personal' ? (
                  <Avatar src={label.avatar} firstName={label.firstName} lastName={label.lastName} size="md" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-500 to-blue-600 flex items-center justify-center text-white">
                    {getConvIcon(conv.type) || <span className="text-sm font-semibold">{label.name[0]}</span>}
                  </div>
                )}
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-5 w-5 flex items-center justify-center rounded-full bg-brand-600 text-white text-[10px] font-bold">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm truncate ${unread > 0 ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-800 dark:text-gray-200'}`}>
                    {label.name}
                  </p>
                  {lastMsg && (
                    <span className="text-[11px] text-gray-400 shrink-0">{formatConvTime(lastMsg.created_at)}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {conv.type !== 'personal' && (
                    <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded capitalize shrink-0">{conv.type}</span>
                  )}
                  {lastMsg && (
                    <p className={`text-xs truncate ${unread > 0 ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                      {lastMsg.deleted_at ? '(deleted)' : lastMsg.content || (lastMsg.file_url ? '📎 File' : '')}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
