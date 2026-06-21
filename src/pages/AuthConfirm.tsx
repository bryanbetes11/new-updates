import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { EmailOtpType } from '@supabase/supabase-js';

type ConfirmStatus = 'checking' | 'success' | 'error';

export function AuthConfirm() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [status, setStatus] = useState<ConfirmStatus>('checking');
  const [message, setMessage] = useState('Confirming your account update...');

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(location.search);

    const confirm = async () => {
      const type = params.get('type');
      const tokenHash = params.get('token_hash');
      const code = params.get('code');

      if (type !== 'email_change') {
        if (!cancelled) {
          setStatus('error');
          setMessage('This confirmation link is not supported here. Please request a fresh email update link.');
        }
        return;
      }

      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as EmailOtpType,
        });

        if (error) {
          if (!cancelled) {
            setStatus('error');
            setMessage(error.message || 'This confirmation link is invalid or expired.');
          }
          return;
        }
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          if (!cancelled) {
            setStatus('error');
            setMessage(error.message || 'This confirmation link is invalid or expired.');
          }
          return;
        }
      } else {
        if (!cancelled) {
          setStatus('error');
          setMessage('This confirmation link is missing its verification token.');
        }
        return;
      }

      await refreshProfile();
      if (!cancelled) {
        setStatus('success');
        setMessage('Your email update was confirmed. ServeSync will now use your updated email address.');
      }
    };

    void confirm();

    return () => {
      cancelled = true;
    };
  }, [location.search]);

  const nextPath = new URLSearchParams(location.search).get('next') || '/profile?email_updated=1';

  const isSuccess = status === 'success';
  const isChecking = status === 'checking';

  return (
    <div className="min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(34,197,94,0.18),transparent_34%),radial-gradient(circle_at_86%_22%,rgba(250,204,21,0.08),transparent_30%),linear-gradient(180deg,#080a08_0%,#050505_54%,#000_100%)]" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-14">
        <div className="mb-10 flex items-center gap-3">
          <img src="/logo.png" alt="ServeSync" className="h-11 w-11 rounded-2xl bg-black/40 object-contain p-2" />
          <span className="text-xl font-black tracking-[-0.04em]">ServeSync</span>
        </div>

        <section className="rounded-[2rem] border border-white/[0.08] bg-white/[0.035] p-7 shadow-[0_30px_90px_-50px_rgba(34,197,94,0.7)] backdrop-blur-xl sm:p-9">
          <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ${
            isChecking
              ? 'bg-white/[0.06] text-white/60'
              : isSuccess
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-red-500/15 text-red-300'
          }`}>
            {isChecking ? <Loader2 className="h-8 w-8 animate-spin" /> : isSuccess ? <CheckCircle2 className="h-8 w-8" /> : <AlertCircle className="h-8 w-8" />}
          </div>

          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.32em] text-emerald-300/70">
            Account Update
          </p>
          <h1 className="text-[2.15rem] font-black leading-[0.98] tracking-[-0.07em] sm:text-5xl">
            {isChecking ? 'Confirming email...' : isSuccess ? 'Email confirmed' : 'Link problem'}
          </h1>
          <p className="mt-5 text-base leading-7 text-white/48">
            {message}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {isSuccess ? (
              <button
                type="button"
                onClick={() => navigate(user ? nextPath : '/login', { replace: true })}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 text-sm font-black text-black transition hover:bg-emerald-400"
              >
                {user ? 'Go to Profile' : 'Go to Sign In'} <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <Link
                to="/login"
                className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-black text-black transition hover:bg-white/90"
              >
                Back to Sign In
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
