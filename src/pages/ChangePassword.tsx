import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, ChevronLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

const requirements = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', test: (p: string) => /[0-9]/.test(p) },
];

export function ChangePassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordOk = requirements.every(r => r.test(next));
  const confirmOk = next === confirm && confirm.length > 0;
  const canSubmit = current.length > 0 && passwordOk && confirmOk;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      // Re-authenticate with current password first
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.email) throw new Error('No user found');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: current,
      });
      if (signInError) {
        toast('error', 'Current password is incorrect.');
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;

      setSuccess(true);
      toast('success', 'Password updated successfully.');
      setTimeout(() => navigate('/profile'), 2000);
    } catch (err: any) {
      toast('error', err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#0d0d0f] flex flex-col">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-[#111113]/80 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="max-w-xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 hover:opacity-75 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <span className="text-[15px] font-bold text-gray-900 dark:text-white tracking-tight mx-auto" style={{ letterSpacing: '-0.02em' }}>
            Change Password
          </span>
          <div className="w-16" />
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 sm:px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >

          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="card p-8 text-center"
            >
              <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-green-50 dark:bg-green-950/40 flex items-center justify-center">
                <CheckCircle className="h-7 w-7 text-green-500" />
              </div>
              <h2 className="text-[17px] font-bold text-gray-900 dark:text-white mb-2" style={{ letterSpacing: '-0.02em' }}>
                Password updated
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your password has been changed successfully. Redirecting you back…
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Current password */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-black/[0.04] dark:border-white/[0.05]">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">Current Password</span>
                  </div>
                </div>
                <div className="p-5">
                  <div className="relative">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      value={current}
                      onChange={e => setCurrent(e.target.value)}
                      placeholder="Enter your current password"
                      autoComplete="current-password"
                      required
                      className="input pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* New password */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-black/[0.04] dark:border-white/[0.05]">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">New Password</span>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div className="relative">
                    <input
                      type={showNext ? 'text' : 'password'}
                      value={next}
                      onChange={e => setNext(e.target.value)}
                      placeholder="Enter new password"
                      autoComplete="new-password"
                      required
                      className="input pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNext(!showNext)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Requirements */}
                  {next.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="grid grid-cols-2 gap-2"
                    >
                      {requirements.map(r => {
                        const met = r.test(next);
                        return (
                          <div key={r.label} className="flex items-center gap-1.5">
                            {met
                              ? <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                              : <AlertCircle className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600 shrink-0" />
                            }
                            <span className={`text-[11px] font-medium ${met ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                              {r.label}
                            </span>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Confirm password */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-black/[0.04] dark:border-white/[0.05]">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">Confirm New Password</span>
                  </div>
                </div>
                <div className="p-5">
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                      required
                      className={`input pr-11 ${confirm.length > 0 ? (confirmOk ? 'border-green-400 focus:border-green-500 focus:ring-green-500/20' : 'border-red-400 focus:border-red-500 focus:ring-red-500/20') : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirm.length > 0 && !confirmOk && (
                    <p className="mt-2 text-[12px] text-red-500 font-medium">Passwords do not match</p>
                  )}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!canSubmit || loading}
                className="btn-primary w-full h-12 text-[14px] disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Updating…
                  </>
                ) : 'Update Password'}
              </button>

              <p className="text-center text-[12px] text-gray-400 dark:text-gray-500 pb-4">
                You'll stay signed in after changing your password.
              </p>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
