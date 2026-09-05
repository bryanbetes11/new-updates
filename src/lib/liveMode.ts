export type LiveAudience = 'stage' | 'tech';
export type LiveStatus = 'sent' | 'seen' | 'adjusting' | 'done' | 'cancelled';
export interface LiveMessage {
  id: string; event_id: string; kind: 'stage_request' | 'tech_instruction' | 'position';
  sender_id: string; sender_name: string; sender_role: string; recipient_id: string | null;
  text: string; status: LiveStatus; operator_name: string | null; revision: number;
  created_at: string; updated_at: string;
}
export interface LiveParticipant { user_id: string; audience: LiveAudience; last_seen: string }
export interface PendingLiveAction {
  id: string; kind: LiveMessage['kind']; text: string; recipient: string | null;
}
export const isPendingLiveAction = (value: unknown): value is PendingLiveAction | null => value === null || (
  typeof value === 'object' && !!value && typeof (value as PendingLiveAction).id === 'string'
  && ['stage_request', 'tech_instruction', 'position'].includes((value as PendingLiveAction).kind)
  && typeof (value as PendingLiveAction).text === 'string'
  && ((value as PendingLiveAction).recipient === null || typeof (value as PendingLiveAction).recipient === 'string')
);
export function mergeLiveMessages(current: LiveMessage[], incoming: LiveMessage[]) {
  const byId = new Map(current.map(item => [item.id, item]));
  incoming.forEach(item => {
    const previous = byId.get(item.id);
    if (!previous || item.revision >= previous.revision) byId.set(item.id, item);
  });
  return [...byId.values()].sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
export const isOpenLiveRequest = (item: LiveMessage) => item.kind === 'stage_request' && !['done','cancelled'].includes(item.status);
export const ownLiveRequests = (items: LiveMessage[], userId?: string) => items.filter(item => item.kind === 'stage_request' && item.sender_id === userId);
export const onlineLiveParticipants = (items: LiveParticipant[], now = Date.now()) => [...new Map(items.filter(item => now - Date.parse(item.last_seen) < 60000).map(item=>[`${item.user_id}:${item.audience}`,item])).values()];
export function liveStatusLabel(status: LiveStatus) {
  return ({sent:'Received',seen:'Seen',adjusting:'Adjusting',done:'Done',cancelled:'Cancelled'})[status];
}
