import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export function ConnectionStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  if (online) return null;
  return (
    <div className="fixed inset-x-3 top-[4.75rem] z-[70] mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-amber-400/25 bg-[#211b0d]/95 px-4 py-3 text-amber-100 shadow-2xl backdrop-blur-xl sm:top-4">
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
      <div className="min-w-0 flex-1"><p className="text-sm font-black">You’re offline</p><p className="text-xs text-amber-100/65">Saved schedules and library snapshots remain available. Changes need connection.</p></div>
      <button type="button" onClick={() => window.location.reload()} className="rounded-xl p-2 text-amber-200 hover:bg-white/10" aria-label="Try reconnecting"><RefreshCw className="h-4 w-4" /></button>
    </div>
  );
}
