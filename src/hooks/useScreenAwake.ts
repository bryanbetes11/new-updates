import { useEffect, useState } from 'react';

export function useScreenAwake(enabled: boolean) {
  const [state,setState]=useState<'active'|'requesting'|'unavailable'>('requesting');
  useEffect(()=>{
    if(!enabled)return;
    let active=true;
    let pending=false;
    let lock:WakeLockSentinel|null=null;
    const acquire=async()=>{
      if(!active||pending||document.visibilityState!=='visible'||(lock&&!lock.released))return;
      if(!navigator.wakeLock){setState('unavailable');return;}
      pending=true;setState('requesting');
      try {
        const next=await navigator.wakeLock.request('screen');
        if(!active){await next.release();return;}
        lock=next;setState('active');
        next.addEventListener('release',()=>{
          if(lock===next)lock=null;
          if(active)setState('unavailable');
        },{once:true});
      }catch{if(active)setState('unavailable');}
      finally{pending=false;}
    };
    void acquire();
    document.addEventListener('visibilitychange',acquire);window.addEventListener('pageshow',acquire);window.addEventListener('focus',acquire);
    return ()=>{active=false;document.removeEventListener('visibilitychange',acquire);window.removeEventListener('pageshow',acquire);window.removeEventListener('focus',acquire);void lock?.release();};
  },[enabled]);
  return state;
}
