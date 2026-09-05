import { useState } from 'react';
import { CheckCircle, MessageCircle, Send, Wifi } from 'lucide-react';
import { getTechMessageGroup, type TechModeMessages } from '../lib/techModeMessages';
import { isOpenLiveRequest, liveStatusLabel, onlineLiveParticipants, ownLiveRequests, type LiveAudience, type LiveMessage, type LiveStatus } from '../lib/liveMode';
import type { LiveModeSession } from '../hooks/useLiveModeSession';

interface Performer { id:string; userId:string; name:string; role:string; status:string }
export function LiveModeComms({session,audience,userId,performers,role,requests,instructions,eventTitle}: {
  session:LiveModeSession; audience:LiveAudience; userId:string; performers:Performer[];role:string;
  requests:TechModeMessages;instructions:TechModeMessages;eventTitle:string;
}) {
  const [recipient,setRecipient]=useState('');
  const [showHistory,setShowHistory]=useState(false);
  const online=onlineLiveParticipants(session.participants);
  const techOnline=online.filter(p=>p.audience==='tech').length;
  const queue=session.messages.filter(isOpenLiveRequest);
  const history=session.messages.filter(m=>m.kind==='stage_request'&&!isOpenLiveRequest(m));
  const own=ownLiveRequests(session.messages,userId);
  const received=session.messages.filter(m=>m.kind==='tech_instruction'&&m.recipient_id===userId);
  const chosen=performers.find(p=>p.userId===recipient);
  const disabled=session.busy||!session.loaded||!!session.pending;
  const send=(kind:'stage_request'|'tech_instruction',text:string,to:string|null=null)=>void session.send({id:crypto.randomUUID(),kind,text,recipient:to});
  const button='min-h-11 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-40';
  const actions=(item:LiveMessage,statuses:LiveStatus[]) => <div className="mt-3 flex flex-wrap gap-2">{statuses.map(status=><button key={status} type="button" disabled={session.busy||!session.loaded||item.status===status} onClick={()=>void session.update(item,status)} className={button}>{status==='sent'?'Reopen':status==='cancelled'?'Cancel request':liveStatusLabel(status)}</button>)}</div>;
  const ownRequest=(item:LiveMessage) => <article key={item.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
    <div className="flex items-start justify-between gap-3"><p className="min-w-0 text-sm font-bold">{item.text}</p><span className="shrink-0 text-xs font-bold text-emerald-300">{liveStatusLabel(item.status)}</span></div>
    <div className="mt-1 flex items-center justify-between gap-2"><time className="text-xs text-white/60" dateTime={item.created_at}>{new Date(item.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time>{isOpenLiveRequest(item)&&<button type="button" disabled={session.busy||!session.loaded} onClick={()=>void session.update(item,'cancelled')} aria-label={`Cancel request: ${item.text}`} className="-my-1 min-h-8 rounded px-2 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40">Cancel</button>}</div>
  </article>;
  const card=(item:LiveMessage,tech:boolean) => <article key={item.id} className="rounded-2xl border border-white/15 bg-white/5 p-4">
    <div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-bold">{item.sender_name} · {item.sender_role}</p><span className="text-xs font-bold text-emerald-300">{liveStatusLabel(item.status)}</span></div>
    <p className="mt-2 text-lg font-bold">{item.text}</p>
    <p className="mt-2 text-xs text-white/60">{new Date(item.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}{item.operator_name?` · Last updated by ${item.operator_name}`:''}</p>
    {tech?actions(item,isOpenLiveRequest(item)?['seen','adjusting','done']:['sent']):isOpenLiveRequest(item)?actions(item,['cancelled']):null}
  </article>;
  return <section aria-label={audience==='tech'?'Tech Team Live Mode':'Stage communications'} className="min-h-0 overflow-y-auto overscroll-contain bg-[#0b100d] text-white">
    <div className="border-b border-white/10 px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">{eventTitle}</p><span className="flex items-center gap-2 text-xs text-emerald-200"><Wifi className="h-4 w-4"/>{session.connection} · {techOnline} tech online</span></div>
      {session.error&&<p role="alert" className="mt-3 text-sm text-amber-200">{session.error} <button className="underline" onClick={()=>void session.refresh()}>Refresh</button></p>}
      {!session.storageAvailable&&<p role="status" className="mt-2 text-sm text-amber-200">Local recovery is unavailable. Keep this screen open until your cue is acknowledged.</p>}
      {session.pending&&<div className="mt-3 rounded-xl border border-amber-400/30 p-3"><p className="text-sm">{session.busy?'Sending':'Awaiting acknowledgement'}: {session.pending.text}</p><div className="mt-2 flex gap-2"><button className={button} disabled={session.busy} onClick={()=>session.pending&&void session.send(session.pending)}>Retry cue</button><button className={button} disabled={session.busy} onClick={session.discard}>Discard retry</button></div></div>}
    </div>
    {audience==='tech'?<div className="mx-auto grid max-w-[1400px] grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <section aria-label="Live requests" className="order-1 min-w-0 p-4 lg:order-2 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">Requests <span className="text-emerald-300">{queue.length}</span></h2><button className={button} onClick={()=>setShowHistory(v=>!v)} aria-expanded={showHistory}>{showHistory?'Show open requests':`History (${history.length})`}</button></div>
        <div className="mt-4 space-y-3">{(showHistory?history:queue).map(m=>card(m,true))}</div>
        {!session.loaded?<p role="status" className="mt-6 text-white/70">Loading saved requests…</p>:!(showHistory?history:queue).length?<div className="mt-4 rounded-2xl border border-dashed border-white/20 p-8 text-center"><CheckCircle className="mx-auto h-7 w-7 text-emerald-300"/><p className="mt-2 font-bold">{showHistory?'No resolved requests':'No open requests'}</p><p className="mt-1 text-sm text-white/60">{showHistory?'Completed and cancelled requests remain here.':'Incoming stage requests appear here, including those sent before you joined.'}</p></div>:null}
      </section>
      <aside aria-label="Assigned performers" className="order-2 border-t border-white/10 p-4 lg:order-1 lg:border-r lg:border-t-0">
        <h2 className="text-lg font-black">Performers</h2><p className="mt-1 text-xs text-white/60">{online.filter(p=>p.audience==='stage').length} online · {performers.length} assigned</p>
        <div className="mt-4 space-y-2">{performers.map(person=><div key={person.id} className="rounded-2xl border border-white/10 p-3"><button className="flex min-h-11 w-full items-center gap-3 text-left disabled:opacity-50" disabled={person.status!=='confirmed'} aria-expanded={recipient===person.userId} onClick={()=>setRecipient(recipient===person.userId?'':person.userId)}><MessageCircle className="h-5 w-5 text-emerald-300"/><span className="min-w-0 flex-1"><span className="block font-bold">{person.name}</span><span className="block text-xs text-white/60">{person.role} · {person.status!=='confirmed'?'Pending confirmation':online.some(p=>p.user_id===person.userId&&p.audience==='stage')?'Online':'Not online'}</span></span><Send className="h-4 w-4"/></button>
          {chosen?.id===person.id&&<div className="mt-3"><p className="text-xs text-white/60">Send to {person.name}</p><div className="mt-2 grid grid-cols-2 gap-2">{instructions[getTechMessageGroup(person.role)].map(text=><button className={button} key={text} disabled={disabled} onClick={()=>send('tech_instruction',text,person.userId)}>{text}</button>)}</div><div className="mt-3 space-y-2">{session.messages.filter(m=>m.kind==='tech_instruction'&&m.recipient_id===person.userId).slice(-3).map(m=><p key={m.id} className="text-xs text-white/65">{m.text} · {m.status==='seen'?'Acknowledged':'Awaiting acknowledgement'}</p>)}</div></div>}
        </div>)}</div>
      </aside>
    </div>:<div className="space-y-3 px-4 py-3">
      {received.filter(m=>m.status!=='seen').map(item=><article key={item.id} className="rounded-2xl border border-amber-300/40 bg-amber-300/10 p-4"><p className="text-xs text-amber-200">From {item.sender_name} · Tech</p><p className="mt-1 text-lg font-bold">{item.text}</p><button className={`${button} mt-3`} disabled={session.busy} onClick={()=>void session.update(item,'seen')}>Acknowledge instruction</button></article>)}
      <div><h2 className="text-sm font-bold">Sound requests · {role}</h2>{techOnline===0&&<p className="mt-1 text-xs text-amber-200">Tech offline · requests will be saved.</p>}<div className="mt-2 grid grid-cols-2 gap-2">{requests[getTechMessageGroup(role)].map(text=><button className={button} key={text} disabled={disabled} onClick={()=>send('stage_request',text)}>{text}</button>)}</div></div>
      {own.length>0&&<div><h3 className="mb-2 text-sm font-bold">Your requests</h3><div className="space-y-2">{own.slice().reverse().map(ownRequest)}</div></div>}
      {received.some(m=>m.status==='seen')&&<details><summary className="min-h-11 cursor-pointer text-sm">Acknowledged instructions</summary>{received.filter(m=>m.status==='seen').map(m=><p key={m.id} className="py-2 text-sm text-white/65">{m.text}</p>)}</details>}
    </div>}
  </section>;
}
