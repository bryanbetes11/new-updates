import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const compile = source => ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const helpers = {exports:{}};
runInNewContext(compile(await readFile(new URL('../src/lib/notificationActivity.ts',import.meta.url),'utf8')),{exports:helpers.exports,module:helpers});
const memory = () => { const items=new Map(); return {getItem:key=>items.get(key)||null,setItem:(key,value)=>items.set(key,value),removeItem:key=>items.delete(key)}; };
const localStorage=memory(),sessionStorage=memory(),navigator={onLine:false};
const id='00000000-0000-4000-8000-000000000031',second='00000000-0000-4000-8000-000000000032';
let activeUser='member', fail=false, calls=[], replaced;
const window={location:{href:`https://example.test/events/demo?mode=team&_notification_open=${id}#members`},history:{state:null,replaceState:(_state,_title,url)=>{replaced=url;}},setTimeout,clearTimeout};
const module={exports:{}};
runInNewContext(compile(await readFile(new URL('../src/lib/notificationOpenTracking.ts',import.meta.url),'utf8')),{
  exports:module.exports,module,URL,Date,AbortController,localStorage,sessionStorage,navigator,window,
  require:name=>name==='./notificationActivity'?helpers.exports:{supabase:{
    auth:{getSession:async()=>({data:{session:{user:{id:activeUser}}}})},
    rpc:(_name,args)=>({abortSignal:async()=>{calls.push(args);return {data:true,error:fail?{message:'offline'}:null};}}),
  }},
});
const api=module.exports;
api.capturePushNotificationOpen();
assert.equal(replaced,'/events/demo?mode=team#members');
api.consumePushNotificationOpen('member');
api.recordNotificationOpen('member',id,'push');
api.recordNotificationOpen('member',second,'bell');
assert.equal(calls.length,0,'offline must queue without blocking');
navigator.onLine=true; fail=true;
await api.flushNotificationOpens('member');
assert.equal(JSON.parse(localStorage.getItem('servesync:notification-opens:member')).length,2,'failure retains queued opens');
calls=[];fail=false;activeUser='other';
await api.flushNotificationOpens('member');
assert.equal(calls.length,0,'account switch cannot replay under wrong user');
activeUser='member';await api.flushNotificationOpens('member');
assert.equal(calls.length,2,'queue deduplicates source and replays after recovery');
assert.equal(calls[0].p_source,'push');assert.equal(calls[1].p_source,'bell');
assert.equal(JSON.parse(localStorage.getItem('servesync:notification-opens:member')).length,0);
console.log('PASS open queue: auth restoration handoff, offline/retry, account isolation, dedupe and route preservation');
