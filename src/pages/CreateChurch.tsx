import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Loader2, Shield, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ThemeToggle } from '../components/ThemeToggle';

function slugifyChurchName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

const inputClass = `w-full h-12 px-4 rounded-xl text-[14px]
  bg-gray-50 dark:bg-white/[0.05]
  border border-gray-200 dark:border-white/[0.08]
  text-gray-900 dark:text-white
  placeholder-gray-400 dark:placeholder-white/20
  focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50
  transition-all duration-200`;

export function CreateChurch() {
  const { user, loading, hasOrganization, isOrgAdmin, refreshProfile, organization } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugifyChurchName(name));
    }
  }, [name, slugTouched]);

  useEffect(() => {
    if (!loading && user && hasOrganization) {
      navigate(isOrgAdmin ? '/leadership/church' : '/dashboard', { replace: true });
    }
  }, [loading, user, hasOrganization, isOrgAdmin, navigate]);

  const slugPreview = useMemo(() => slug.trim().toLowerCase(), [slug]);

  const handleCreateChurch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login?redirect=/create-church', { replace: true });
      return;
    }
    if (!name.trim()) {
      toast('error', 'Church name is required');
      return;
    }
    if (!slugPreview) {
      toast('error', 'Church slug is required');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.rpc('create_organization_for_current_user', {
      p_name: name.trim(),
      p_slug: slugPreview,
      p_logo_url: logoUrl.trim() || null,
    });
    setSubmitting(false);

    if (error) {
      if (error.message.toLowerCase().includes('duplicate')) {
        toast('error', 'That church URL is already taken');
      } else {
        toast('error', error.message);
      }
      return;
    }

    await refreshProfile();
    toast('success', 'Church created. Your 10-day trial has started.');
    navigate('/leadership/church', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] dark:bg-[#0d0d0f] transition-colors duration-300">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600 dark:text-emerald-400" />
      </div>
    );
  }

  if (hasOrganization) return null;

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#0d0d0f] transition-colors duration-300">

      {/* Back button — fixed top-left */}
      <div className="fixed top-4 left-4 z-30">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium text-gray-500 dark:text-white/40 bg-white/90 dark:bg-white/[0.07] backdrop-blur-md border border-gray-200/70 dark:border-white/[0.09] shadow-sm hover:text-gray-800 dark:hover:text-white/70 transition-all duration-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
      </div>

      {/* Theme toggle — fixed top-right */}
      <div className="fixed top-4 right-4 z-30">
        <div className="bg-white/90 dark:bg-white/[0.07] backdrop-blur-md rounded-xl border border-gray-200/70 dark:border-white/[0.09] shadow-sm transition-colors duration-300">
          <ThemeToggle />
        </div>
      </div>

      <div className="flex items-center justify-center min-h-screen px-6 py-20">
        <div className="w-full max-w-[400px]">

          {/* ── NOT LOGGED IN ── */}
          {!user && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative bg-white dark:bg-white/[0.025] rounded-3xl border border-gray-200/80 dark:border-white/[0.06] p-8 shadow-[0_2px_8px_rgba(0,0,0,0.05),0_16px_48px_rgba(0,0,0,0.06)] dark:shadow-none transition-colors duration-300">
                <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.07] dark:via-white/[0.12] to-transparent" />

                <div className="flex items-center gap-3 mb-6">
                  <div className="h-11 w-11 rounded-2xl bg-emerald-50 dark:bg-emerald-500/[0.12] flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-white/30 mb-0.5 transition-colors duration-300">New Church</p>
                    <h1 className="text-[18px] font-bold text-gray-900 dark:text-white tracking-[-0.02em] transition-colors duration-300">Create your church</h1>
                  </div>
                </div>

                <p className="text-[14px] text-gray-500 dark:text-white/40 leading-relaxed mb-6 transition-colors duration-300">
                  Start a new church on ServeSync. You'll become the first admin and can then invite your whole team.
                </p>

                <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/[0.07] border border-emerald-100 dark:border-emerald-500/[0.12] mb-6 transition-colors duration-300">
                  <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[13px] text-emerald-700 dark:text-emerald-300/80 leading-relaxed transition-colors duration-300">
                    You become the first church admin with a <span className="font-semibold">10-day free trial</span> to explore all features.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <Link
                    to="/login?redirect=/create-church"
                    className="w-full h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
                  >
                    Sign In <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/register?create_church=1&redirect=/create-church"
                    className="w-full h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/[0.10] text-gray-700 dark:text-white/70 active:scale-[0.98] transition-all border border-gray-200/80 dark:border-white/[0.06]"
                  >
                    Create Account
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── LOGGED IN: FORM ── */}
          {user && !hasOrganization && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative bg-white dark:bg-white/[0.025] rounded-3xl border border-gray-200/80 dark:border-white/[0.06] p-8 shadow-[0_2px_8px_rgba(0,0,0,0.05),0_16px_48px_rgba(0,0,0,0.06)] dark:shadow-none transition-colors duration-300">
                <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.07] dark:via-white/[0.12] to-transparent" />

                <div className="flex items-center gap-3 mb-6">
                  <div className="h-11 w-11 rounded-2xl bg-emerald-50 dark:bg-emerald-500/[0.12] flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-white/30 mb-0.5 transition-colors duration-300">New Church</p>
                    <h1 className="text-[18px] font-bold text-gray-900 dark:text-white tracking-[-0.02em] transition-colors duration-300">Create your church</h1>
                  </div>
                </div>

                <p className="text-[13px] text-gray-400 dark:text-white/30 mb-6 transition-colors duration-300">
                  Signed in as <span className="font-semibold text-gray-600 dark:text-white/50">{user.email}</span>
                </p>

                <form onSubmit={handleCreateChurch} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.12em] mb-2 transition-colors duration-300">
                      Church Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className={inputClass}
                      placeholder="Grace Worship Center"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.12em] mb-2 transition-colors duration-300">
                      Church URL Slug
                    </label>
                    <input
                      type="text"
                      value={slug}
                      onChange={e => {
                        setSlugTouched(true);
                        setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                      }}
                      className={inputClass}
                      placeholder="grace-worship-center"
                      required
                    />
                    <p className="text-[12px] text-gray-400 dark:text-white/25 mt-2 transition-colors duration-300">
                      Invite link uses: <span className="font-mono text-gray-500 dark:text-white/35">{slugPreview || 'your-church-slug'}</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.12em] mb-2 transition-colors duration-300">
                      Logo URL <span className="normal-case font-normal text-gray-300 dark:text-white/20">(optional)</span>
                    </label>
                    <input
                      type="url"
                      value={logoUrl}
                      onChange={e => setLogoUrl(e.target.value)}
                      className={inputClass}
                      placeholder="https://..."
                    />
                  </div>

                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/[0.07] border border-emerald-100 dark:border-emerald-500/[0.12] transition-colors duration-300">
                    <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-[13px] text-emerald-700 dark:text-emerald-300/80 leading-relaxed transition-colors duration-300">
                      This account becomes the first church admin and can immediately invite team members.
                    </p>
                  </div>

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={submitting || !name.trim() || !slugPreview}
                      className="w-full h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20"
                    >
                      {submitting
                        ? <><Loader2 className="h-4 w-4 animate-spin" />Creating church…</>
                        : <>Create Church <ArrowRight className="h-4 w-4" /></>}
                    </button>
                  </div>
                </form>

                {organization && (
                  <p className="text-[12px] text-gray-400 dark:text-white/25 mt-4 text-center transition-colors duration-300">
                    Current church: {organization.name}
                  </p>
                )}
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
}
