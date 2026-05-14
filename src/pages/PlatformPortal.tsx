import { useEffect, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, LogOut, Shield, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { PageLoader } from '../components/LoadingSpinner';
import { PlatformDashboard } from './PlatformDashboard';
import { PlatformActivityLog } from './PlatformActivityLog';

interface PlatformPortalProps {
  view?: 'dashboard' | 'activity';
}

export function PlatformPortal({ view = 'dashboard' }: PlatformPortalProps) {
  const { user, loading, isPlatformOwner, signIn, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('bryanbetes11@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && isPlatformOwner) {
      document.title = 'ServeSync Platform';
      return;
    }
    document.title = 'Platform Access';
  }, [user, isPlatformOwner]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);

    if (error) {
      toast('error', error.message);
      return;
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setPassword('');
  };

  if (loading) return <PageLoader />;

  if (user && isPlatformOwner) {
    if (view === 'activity') return <PlatformActivityLog />;
    return <PlatformDashboard />;
  }

  if (user && !isPlatformOwner) {
    return (
      <div className="min-h-screen bg-[#060709] flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md rounded-[32px] border border-white/[0.08] bg-white/[0.03] p-7 text-center shadow-[0_24px_80px_-24px_rgba(0,0,0,0.45)]">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mb-5">
            <Shield className="h-6 w-6" />
          </div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-white/30 mb-2">Platform Access</p>
          <h1 className="text-2xl font-black text-white tracking-tight">This account is not allowed here.</h1>
          <p className="mt-3 text-sm text-white/45">
            The platform portal is reserved for the website owner account only. Sign out and use the correct owner login.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button onClick={handleSignOut} className="btn-primary flex-1 justify-center">
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-secondary flex-1 justify-center"
            >
              Back to App
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060709] flex overflow-hidden">
      <div
        className="hidden lg:flex lg:w-[54%] relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #07110a 0%, #0d1911 44%, #060b07 100%)' }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-12%] right-[-8%] w-[540px] h-[540px] rounded-full bg-emerald-500/[0.08] blur-[110px]" />
          <div className="absolute bottom-[-12%] left-[-8%] w-[420px] h-[420px] rounded-full bg-sky-500/[0.06] blur-[90px]" />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="h-10 w-10 rounded-[24%] flex items-center justify-center bg-white/[0.05] border border-white/[0.08] text-emerald-400">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-white tracking-tight">ServeSync Platform</p>
            <p className="text-[10px] font-semibold text-emerald-500/70 uppercase tracking-widest">Owner Portal</p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <p className="text-[11px] font-bold tracking-widest text-emerald-500/60 uppercase mb-4">Private Control Plane</p>
          <h2 className="text-[clamp(2.1rem,3.5vw,3.4rem)] font-black text-white leading-[1.04] tracking-[-0.04em]">
            Manage tenants,
            <br />
            billing, and growth
            <br />
            from one place.
          </h2>
          <p className="mt-6 text-[15px] text-white/38 leading-relaxed max-w-md">
            This is separate from the ministry app. Only the platform owner account can review registrations, church subscriptions, and tenant-level operations here.
          </p>

          <div className="mt-10 space-y-3">
            {[
              'Owner-only access to all churches and registrations',
              'Manual billing review and subscription oversight',
              'Separate from the team-facing worship workspace',
            ].map(item => (
              <div key={item} className="flex items-center gap-3">
                <div className="h-5 w-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </div>
                <span className="text-sm text-white/70">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/20">Restricted owner access only.</p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 sm:px-10 py-12 bg-[#060709]">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-8 w-8 rounded-[24%] flex items-center justify-center bg-white/[0.05] border border-white/[0.08] text-emerald-400">
              <LockKeyhole className="h-4 w-4" />
            </div>
            <span className="text-[14px] font-bold text-white tracking-tight">ServeSync Platform</span>
          </div>

          <div className="mb-9">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-white/30 mb-2">Owner Portal</p>
            <h1 className="text-[28px] font-black text-white tracking-[-0.03em] leading-tight">
              Private platform login
            </h1>
            <p className="mt-3 text-[14px] text-white/38 leading-relaxed">
              Use the owner account to access the platform dashboard. This login is separate from the normal team-facing app flow.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-white/30 uppercase tracking-[0.12em] mb-2">Owner email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-12 px-4 rounded-xl text-[14px] bg-white/[0.05] border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-white/30 uppercase tracking-[0.12em] mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full h-12 px-4 pr-12 rounded-xl text-[14px] bg-white/[0.05] border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all"
                  placeholder="Your owner password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-white/25 hover:text-white/50 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !email || !password}
              className="w-full h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Open Platform
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
