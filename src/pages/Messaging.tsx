import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, X, Users, Search, Check, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Avatar } from '../components/Avatar';
import { ConversationList } from './messaging/ConversationList';
import { ChatWindow } from './messaging/ChatWindow';
import type { Conversation, Profile } from '../types';

interface NewConvMember { id: string; first_name: string; last_name: string; avatar_url: string | null; }

export function Messaging() {
  const { user, isLeader } = useAuth();
  const toast = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newType, setNewType] = useState<'personal' | 'group'>('personal');
  const [newName, setNewName] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<NewConvMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<NewConvMember[]>([]);
  const [creating, setCreating] = useState(false);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [isMobileChat, setIsMobileChat] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        events:event_id(id, title),
        conversation_members(id, user_id, last_read_at, profiles:user_id(id, first_name, last_name, avatar_url)),
        latest_message:messages(id, content, created_at, sender_id, deleted_at, file_url)
      `)
      .order('updated_at', { ascending: false });
    if (!error && data) {
      const convs = (data as Conversation[]).map(c => ({
        ...c,
        latest_message: Array.isArray(c.latest_message)
          ? (c.latest_message as Conversation['latest_message'][]).sort((a, b) =>
              new Date(b!.created_at).getTime() - new Date(a!.created_at).getTime()
            )[0]
          : c.latest_message,
      }));
      setConversations(convs);

      const unread: Record<string, number> = {};
      convs.forEach(c => {
        const myMember = c.conversation_members?.find(m => m.user_id === user.id);
        if (!myMember || !c.latest_message) return;
        const lastRead = myMember.last_read_at ? new Date(myMember.last_read_at).getTime() : 0;
        const lastMsg = new Date(c.latest_message.created_at).getTime();
        if (lastMsg > lastRead && c.latest_message.sender_id !== user.id) unread[c.id] = 1;
      });
      setUnreadMap(unread);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('conversations_list')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, () => fetchConversations())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => fetchConversations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchConversations]);

  const searchMembers = useCallback(async (q: string) => {
    if (q.length < 1) { setMemberResults([]); return; }
    const { data } = await supabase.from('profiles').select('id, first_name, last_name, avatar_url').or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`).neq('id', user?.id).limit(15);
    setMemberResults((data || []).map(p => ({ id: p.id, first_name: p.first_name, last_name: p.last_name, avatar_url: p.avatar_url })));
  }, [user]);

  useEffect(() => {
    const t = setTimeout(() => searchMembers(memberSearch), 300);
    return () => clearTimeout(t);
  }, [memberSearch, searchMembers]);

  const toggleMember = (m: NewConvMember) => {
    setSelectedMembers(prev => prev.find(p => p.id === m.id) ? prev.filter(p => p.id !== m.id) : [...prev, m]);
  };

  const createConversation = async () => {
    if (!user) return;
    if (selectedMembers.length === 0) { toast('error', 'Select at least one member'); return; }
    if (newType === 'group' && !newName.trim()) { toast('error', 'Group name is required'); return; }

    setCreating(true);
    const memberIds = [user.id, ...selectedMembers.map(m => m.id)];

    if (newType === 'personal' && selectedMembers.length === 1) {
      const existingDM = conversations.find(c =>
        c.type === 'personal' &&
        c.conversation_members?.some(m => m.user_id === selectedMembers[0].id)
      );
      if (existingDM) {
        setSelectedId(existingDM.id);
        setIsMobileChat(true);
        setShowNew(false);
        setCreating(false);
        return;
      }
    }

    const { data: convId, error } = await supabase.rpc('create_conversation_with_members', {
      p_type: newType,
      p_name: newType === 'group' ? newName.trim() : null,
      p_event_id: null,
      p_member_ids: memberIds,
    });

    if (error || !convId) {
      toast('error', 'Failed to create conversation');
    } else {
      setSelectedId(convId as string);
      setIsMobileChat(true);
      setShowNew(false);
      setNewName('');
      setSelectedMembers([]);
      setMemberSearch('');
      await fetchConversations();
    }
    setCreating(false);
  };

  const selectedConv = conversations.find(c => c.id === selectedId) || null;

  const handleSelectConv = (id: string) => {
    setSelectedId(id);
    setIsMobileChat(true);
  };

  const handleBack = () => {
    setIsMobileChat(false);
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-container h-[calc(100vh-4rem)] sm:h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
      <div className="flex-1 flex overflow-hidden">
        <div className={`w-full sm:w-80 lg:w-96 border-r border-gray-100 dark:border-gray-800 flex-shrink-0 ${isMobileChat ? 'hidden sm:flex' : 'flex'} flex-col`}>
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={handleSelectConv}
            onNew={() => setShowNew(true)}
            currentUserId={user?.id || ''}
            unreadMap={unreadMap}
            search={search}
            onSearchChange={setSearch}
          />
        </div>

        <div className={`flex-1 flex flex-col ${!isMobileChat ? 'hidden sm:flex' : 'flex'}`}>
          {selectedConv && user ? (
            <ChatWindow
              conversation={selectedConv}
              currentUserId={user.id}
              isLeader={isLeader}
              onBack={handleBack}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="h-16 w-16 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-brand-600 dark:text-brand-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Your Messages</h3>
              <p className="text-sm text-gray-400 dark:text-gray-500">Select a conversation or start a new one</p>
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <p className="text-base font-semibold text-gray-900 dark:text-white">New Conversation</p>
              <button onClick={() => { setShowNew(false); setSelectedMembers([]); setNewName(''); setMemberSearch(''); }} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="flex items-center gap-2">
                {(['personal', 'group'] as const).map(t => (
                  <button key={t} onClick={() => setNewType(t)} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${newType === t ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                    {t === 'personal' ? 'Direct Message' : 'Group Chat'}
                  </button>
                ))}
              </div>

              {newType === 'group' && (
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Group name..." className="input-field text-sm" />
              )}

              <div>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search members..." className="input-field pl-9 text-sm py-2" />
                </div>
                {selectedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedMembers.map(m => (
                      <span key={m.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-full text-xs">
                        {m.first_name} {m.last_name}
                        <button onClick={() => toggleMember(m)} className="p-0.5 rounded-full hover:bg-brand-200 dark:hover:bg-brand-800 transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {memberResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
                    {memberResults.map(m => {
                      const isSelected = selectedMembers.some(s => s.id === m.id);
                      return (
                        <button key={m.id} onClick={() => toggleMember(m)} className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <Avatar src={m.avatar_url} firstName={m.first_name} lastName={m.last_name} size="sm" />
                          <p className="flex-1 text-sm text-left text-gray-900 dark:text-white">{m.first_name} {m.last_name}</p>
                          {isSelected && <Check className="h-4 w-4 text-brand-600 dark:text-brand-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                onClick={createConversation}
                disabled={creating || selectedMembers.length === 0}
                className="w-full btn-primary"
              >
                {creating ? <><Loader className="h-4 w-4 animate-spin" /> Creating...</> : 'Start Conversation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
