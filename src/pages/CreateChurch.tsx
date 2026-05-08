import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Loader2, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a]">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600 dark:text-emerald-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-lg animate-fade-in">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 mb-7 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to home
            </button>

            <div className="card p-0 overflow-hidden">
              <div className="px-6 py-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#141416]">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1">New Church</p>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Create your church workspace</h1>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 space-y-4">
                <p className="text-sm text-gray-600 dark:text-white/55">
                  Start a new church on ServeSync. You’ll create the church, become its first admin, and then invite your team.
                </p>

                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/10 p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">You become the first church admin</p>
                    <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                        After setup, you can manage church settings, invites, and a 10-day trial before billing for your team.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Link to="/login?redirect=/create-church" className="btn-primary justify-center">
                    Sign In
                  </Link>
                  <Link to="/register?create_church=1&redirect=/create-church" className="btn-secondary justify-center">
                    Create Account
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (hasOrganization) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg animate-fade-in">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 mb-7 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </button>

          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#141416]">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/[0.12] text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-white/35 mb-1">New Church</p>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">Create your church workspace</h1>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateChurch} className="px-6 py-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-white/55">
                You’re signed in as <span className="font-semibold">{user.email}</span>. Create your church to start inviting your team and unlock a 10-day free trial.
              </p>

              <div>
                <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Church Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input-field"
                  placeholder="Grace Worship Center"
                  required
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Church URL Slug</label>
                <input
                  type="text"
                  value={slug}
                  onChange={e => {
                    setSlugTouched(true);
                    setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                  }}
                  className="input-field"
                  placeholder="grace-worship-center"
                  required
                />
                <p className="text-xs text-gray-400 mt-1.5">Used for invite links: <span className="font-mono">{slugPreview || 'your-church-slug'}</span></p>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Logo URL <span className="font-normal text-gray-400">(optional)</span></label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={e => setLogoUrl(e.target.value)}
                  className="input-field"
                  placeholder="https://..."
                />
              </div>

              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/10 p-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Church admin access</p>
                    <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                      This account will become the first church admin and can immediately invite other members.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !name.trim() || !slugPreview}
                className="btn-primary w-full py-3 text-[15px]"
              >
                {submitting ? (
                  <span className="flex items-center gap-2 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating church...
                  </span>
                ) : (
                  'Create Church'
                )}
              </button>

              {organization && (
                <p className="text-xs text-gray-400">Current church: {organization.name}</p>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
