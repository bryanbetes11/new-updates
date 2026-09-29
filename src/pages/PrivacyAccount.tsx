import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

type DocumentKind = 'privacy' | 'terms';

const documents: Record<DocumentKind, { title: string; url: string }> = {
  privacy: { title: 'Privacy statement', url: '/privacy.html' },
  terms: { title: 'Private pilot terms', url: '/pilot-terms.html' },
};

export function PrivacyAccount() {
  const { user, signOut, forgetSavedAccount } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const documentFrameRef = useRef<HTMLIFrameElement>(null);
  const documentResizeObserverRef = useRef<ResizeObserver | null>(null);
  const [documentKind, setDocumentKind] = useState<DocumentKind>('privacy');
  const [showDelete, setShowDelete] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const root = documentFrameRef.current?.contentDocument?.documentElement;
    if (root) root.dataset.theme = theme;
  }, [theme, documentKind]);

  useEffect(() => () => documentResizeObserverRef.current?.disconnect(), []);

  const handleDocumentLoad = (frame: HTMLIFrameElement) => {
    documentResizeObserverRef.current?.disconnect();
    const documentRoot = frame.contentDocument?.documentElement;
    const documentMain = frame.contentDocument?.querySelector('main');
    if (!documentRoot || !documentMain) return;
    documentRoot.dataset.theme = theme;
    documentRoot.dataset.embedded = 'true';
    const resize = () => { frame.style.height = `${Math.max(520, Math.ceil(documentMain.getBoundingClientRect().height + 2))}px`; };
    resize();
    documentResizeObserverRef.current = new ResizeObserver(resize);
    documentResizeObserverRef.current.observe(documentMain);
  };

  const submitDeletion = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.email || confirmation !== 'DELETE' || !password || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password });
      if (signInError) throw new Error('That password is incorrect. Your account is still active.');
      const { data, error: requestError } = await supabase.functions.invoke('request-account-deletion', {
        body: { confirmation: 'DELETE MY ACCOUNT' },
      });
      if (requestError || data?.accessDisabled !== true) {
        throw new Error('We could not confirm that account access ended. Please try again or contact support.');
      }
      forgetSavedAccount(user.id);
      await signOut();
      navigate('/login?account-deletion=requested', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit the deletion request.');
    } finally {
      setPassword('');
      setSubmitting(false);
    }
  };

  const activeDocument = documents[documentKind];
  return (
    <div className="page-container page-bottom-pad">
      <div className="app-content-shell mx-auto max-w-6xl space-y-5 pt-4 sm:pt-5">
        <header className="rounded-3xl border border-gray-200/80 bg-white p-5 dark:border-white/[0.07] dark:bg-white/[0.025] sm:p-7">
          <Link to="/settings/app" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300 lg:hidden"><ArrowLeft className="h-4 w-4" /> App settings</Link>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-300" />
            <h1 className="text-2xl font-black tracking-tight text-gray-950 dark:text-white">Privacy &amp; Account</h1>
          </div>
          <p className="mt-2 pl-9 text-sm text-gray-600 dark:text-gray-300">Read how ServeSync handles your information and manage your account.</p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)] lg:items-start">
        <section aria-labelledby="documents-title" className="min-w-0 rounded-3xl border border-gray-200/80 bg-white p-5 dark:border-white/[0.07] dark:bg-white/[0.025] sm:p-6">
          <div className="mb-4 flex items-center gap-3"><FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-300" /><h2 id="documents-title" className="text-lg font-bold text-gray-950 dark:text-white">Documents</h2></div>
          <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Privacy documents">
            {(Object.keys(documents) as DocumentKind[]).map(kind => (
              <button key={kind} type="button" role="tab" aria-selected={documentKind === kind} onClick={() => setDocumentKind(kind)} className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${documentKind === kind ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white'}`}>{documents[kind].title}</button>
            ))}
          </div>
          <iframe ref={documentFrameRef} key={documentKind} title={activeDocument.title} src={activeDocument.url} onLoad={event => handleDocumentLoad(event.currentTarget)} scrolling="no" className="min-h-[520px] w-full rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#0b1215] lg:rounded-none lg:border-0" />
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">You can also <a href={activeDocument.url} target="_blank" rel="noopener noreferrer" className="underline">open this document separately</a>.</p>
        </section>

        <section aria-labelledby="delete-title" className="rounded-3xl border border-red-200 bg-white p-5 dark:border-red-400/20 dark:bg-white/[0.025] sm:p-6 lg:sticky lg:top-40">
          <div className="flex items-center gap-3"><Trash2 className="h-5 w-5 text-red-600 dark:text-red-300" /><h2 id="delete-title" className="text-lg font-bold text-gray-950 dark:text-white">Delete account</h2></div>
          <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">When you confirm, your access to ServeSync will end immediately. We will process deletion of your personal account data. Some shared church records may be kept where needed, as explained in the privacy statement.</p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">You can also request deletion after uninstalling at <a href="/delete-account.html" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 underline dark:text-emerald-300">our account deletion page</a>.</p>
          {!showDelete ? <button type="button" onClick={() => setShowDelete(true)} className="mt-5 min-h-11 rounded-xl border border-red-300 px-4 text-sm font-bold text-red-700 hover:bg-red-50 dark:border-red-400/40 dark:text-red-300 dark:hover:bg-red-400/10">Delete my account</button> : (
            <form onSubmit={event => void submitDeletion(event)} className="mt-5 space-y-4 rounded-2xl border border-red-200 bg-red-50/60 p-4 dark:border-red-400/20 dark:bg-red-400/[0.06]">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Confirm deletion for {user?.email ?? 'your account'}</p>
              <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">Current password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-gray-950 dark:border-white/20 dark:bg-[#171a1c] dark:text-white" /></label>
              <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">Type DELETE to confirm<input type="text" autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-gray-950 dark:border-white/20 dark:bg-[#171a1c] dark:text-white" /></label>
              {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
              <div className="flex flex-wrap gap-2"><button type="button" disabled={submitting} onClick={() => { setShowDelete(false); setPassword(''); setConfirmation(''); setError(''); }} className="min-h-11 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-800 dark:border-white/20 dark:text-white">Cancel</button><button type="submit" disabled={submitting || !password || confirmation !== 'DELETE'} className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50">{submitting ? 'Submitting…' : 'Confirm account deletion'}</button></div>
            </form>
          )}
        </section>
        </div>
      </div>
    </div>
  );
}
