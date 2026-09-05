import { useCallback, useEffect, useRef, useState } from 'react';
import { withSaveTimeout } from '../lib/saveTimeout';
import { supabase } from '../lib/supabase';
import { useRecoverableDraft } from './useRecoverableDraft';
import { draftRecoveryKey } from '../lib/draftRecovery';
import { isPendingLiveAction, mergeLiveMessages, type LiveAudience, type LiveMessage, type LiveParticipant, type LiveStatus, type PendingLiveAction } from '../lib/liveMode';

export function useLiveModeSession(eventId: string | undefined, orgId: string | undefined | null, userId: string | undefined, enabled: boolean, audience: LiveAudience) {
  const [messages,setMessages] = useState<LiveMessage[]>([]);
  const [participants,setParticipants] = useState<LiveParticipant[]>([]);
  const [connection,setConnection] = useState('Connecting');
  const [error,setError] = useState('');
  const [refreshError,setRefreshError] = useState('');
  const [loaded,setLoaded] = useState(false);
  const [busy,setBusy] = useState(false);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const [deviceSession] = useState(()=>crypto.randomUUID());
  const [pending,setPending,recovery] = useRecoverableDraft<PendingLiveAction | null>(draftRecoveryKey(`live-cue:${eventId}`,orgId,userId),null,isPendingLiveAction);
  const refreshRef = useRef<() => Promise<void>>(async()=>{});

  useEffect(() => {
    const epoch = ++generation.current;
    setMessages([]); setParticipants([]); setLoaded(false); setError(''); setRefreshError('');
    if (!enabled || !eventId || !userId) return;
    let active = true;
    let refreshing = false;
    let subscribed = false;
    const refresh = async () => {
      if (!active || refreshing || document.visibilityState==='hidden') return;
      refreshing = true;
      try {
        // Paginate so a long rehearsal never drops an older unanswered request.
        const rows: LiveMessage[] = [];
        for (let offset=0;;offset+=500) {
          const result = await supabase.from('live_mode_messages').select('*').eq('event_id',eventId).order('created_at').order('id').range(offset,offset+499);
          if (result.error) throw result.error;
          rows.push(...result.data as LiveMessage[]);
          if (result.data.length<500) break;
        }
        const presence = await supabase.from('live_mode_participants').select('user_id,audience,last_seen').eq('event_id',eventId);
        if (presence.error) throw presence.error;
        if (active && epoch===generation.current) {
          setMessages(current=>mergeLiveMessages(current,rows)); setParticipants(presence.data as LiveParticipant[]);
          setLoaded(true); setRefreshError(''); setConnection(subscribed?'Live':'Connected · refreshing every 5s');
        }
      } catch (cause) {
        if (active) { setConnection(navigator.onLine?'Reconnecting':'Offline'); setRefreshError(cause instanceof Error?cause.message:'Could not refresh Live Mode. Your last received requests remain visible.'); }
      } finally { refreshing=false; }
    };
    refreshRef.current=refresh;
    const heartbeat = async () => {
      if (!active || document.visibilityState==='hidden') return;
      try { const {error: heartbeatError}=await supabase.rpc('live_mode_heartbeat',{p_event:eventId,p_audience:audience,p_session:deviceSession});
      if (active && heartbeatError) setRefreshError(heartbeatError.message); } catch { if(active)setRefreshError('Could not update device presence.'); }
    };
    const channel=supabase.channel(`live-mode:${eventId}:${userId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'live_mode_messages',filter:`event_id=eq.${eventId}`},()=>void refresh())
      .subscribe(status=>{ subscribed=status==='SUBSCRIBED'; if(active){setConnection(subscribed?'Live':'Reconnecting'); void refresh();} });
    const resume=()=>{void heartbeat();void refresh();};
    const offline=()=>setConnection('Offline');
    resume();
    const poll=window.setInterval(()=>void refresh(),5000);
    const beat=window.setInterval(()=>void heartbeat(),20000);
    window.addEventListener('online',resume); window.addEventListener('offline',offline);
    window.addEventListener('focus',resume); document.addEventListener('visibilitychange',resume);
    return ()=>{
      active=false; generation.current=epoch+1; window.clearInterval(poll);window.clearInterval(beat);
      window.removeEventListener('online',resume);window.removeEventListener('offline',offline);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);
      void supabase.removeChannel(channel);
      void Promise.resolve(supabase.rpc('live_mode_heartbeat',{p_event:eventId,p_audience:audience,p_session:deviceSession,p_active:false})).catch(()=>{});
    };
  },[eventId,userId,enabled,audience,deviceSession]);

  const send = useCallback(async(action:PendingLiveAction) => {
    if (inFlight.current || !enabled || !eventId) return false;
    inFlight.current=true;setBusy(true);setError('');setPending(action);
    const epoch=generation.current;
    try {
      const {data,error:sendError}=await withSaveTimeout(supabase.rpc('send_live_mode_message',{p_event:eventId,p_id:action.id,p_kind:action.kind,p_text:action.text,p_recipient:action.recipient}));
      if(sendError || !data) throw new Error(sendError?.message || 'No acknowledgement received. Retry this cue.');
      if(epoch===generation.current){setMessages(current=>mergeLiveMessages(current,[data as LiveMessage]));setPending(null);}
      return true;
    } catch(cause) {if(epoch===generation.current)setError(cause instanceof Error?cause.message:'Cue was not acknowledged. Retry below.');return false;}
    finally{inFlight.current=false;setBusy(false);}
  },[enabled,eventId,setPending]);
  const update = async(item:LiveMessage,status:LiveStatus)=>{
    if(inFlight.current || !enabled)return false;
    inFlight.current=true;setBusy(true);setError(''); const epoch=generation.current;
    try {
      const {data,error:updateError}=await withSaveTimeout(supabase.rpc('update_live_mode_message',{p_id:item.id,p_status:status,p_revision:item.revision}));
      if(updateError || !data)throw new Error(updateError?.message || 'Status was not acknowledged. Try again.');
      if(epoch===generation.current)setMessages(current=>mergeLiveMessages(current,[data as LiveMessage]));return true;
    }catch(cause){if(epoch===generation.current)setError(cause instanceof Error?cause.message:'Could not update request.');void refreshRef.current();return false;}
    finally{inFlight.current=false;setBusy(false);}
  };
  return {messages,participants,connection,error:error || refreshError,loaded,busy,pending,storageAvailable:recovery.available,send,update,discard:()=>setPending(null),refresh:()=>refreshRef.current()};
}
export type LiveModeSession = ReturnType<typeof useLiveModeSession>;
