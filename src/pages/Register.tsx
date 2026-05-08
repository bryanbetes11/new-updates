import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Check, Cake, Crown, ArrowLeft, Music } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { DatePicker } from '../components/DatePicker';
import { sortRolesLeadershipFirst } from '../components/RoleBadge';

export function Register() {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthday, setBirthday] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp, user, roles } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  if (user) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const toggleRole = (roleId: string) => {
    setSelectedRoles(prev =>
      prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast('error', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, firstName);
    if (error) {
      toast('error', error.message);
      setLoading(false);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const updates: Record<string, unknown> = {};
      if (birthday) updates.birthday = birthday;
      if (Object.keys(updates).length > 0) {
        await supabase.from('profiles').update(updates).eq('id', session.user.id);
      }
      if (selectedRoles.length > 0) {
        await supabase.from('user_roles').insert(
          selectedRoles.map(role_id => ({ user_id: session.user.id, role_id }))
        );
      }
    }

    setLoading(false);
    toast('success', 'Account created! Welcome aboard.');
    navigate('/onboarding');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-7">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 mb-7 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to home
            </button>

            <div className="flex justify-center mb-5">
              <div className="relative">
                <img
                  src="/Applogo.png"
                  alt="Worship Portal"
                  className="h-14 w-14 rounded-[22%] shadow-lg shadow-black/10 dark:shadow-black/30"
                />
                <div className="absolute -bottom-1 -right-1 flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500 ring-2 ring-gray-50 dark:ring-[#0a0a0a]">
                  <Music className="h-2.5 w-2.5 text-white" />
                </div>
              </div>
            </div>

            <div className="text-center">
              <h1 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">Create your account</h1>
              <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">Join your worship team on the portal</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="input-field"
                placeholder="Your first name"
                autoComplete="given-name"
                required
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field pr-11"
                  placeholder="Min 6 characters"
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                <span className="flex items-center gap-1.5"><Cake className="h-3.5 w-3.5" /> Birthday <span className="font-normal text-gray-400">(optional)</span></span>
              </label>
              <DatePicker value={birthday} onChange={setBirthday} placeholder="Select your birthday" />
            </div>

            {roles.length > 0 && (
              <div>
                <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-2">
                  Your roles <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {sortRolesLeadershipFirst(roles).map(role => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => toggleRole(role.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ring-1 ${
                        selectedRoles.includes(role.id)
                          ? role.is_leadership
                            ? 'bg-amber-50 dark:bg-amber-900/20 ring-amber-300 dark:ring-amber-700 text-amber-700 dark:text-amber-300'
                            : 'bg-emerald-50 dark:bg-emerald-900/20 ring-emerald-300 dark:ring-emerald-700 text-emerald-700 dark:text-emerald-300'
                          : 'bg-white dark:bg-[#232325] ring-gray-200 dark:ring-gray-700 text-gray-600 dark:text-gray-400 hover:ring-gray-300'
                      }`}
                    >
                      {selectedRoles.includes(role.id) && <Check className="h-3 w-3" />}
                      {role.is_leadership && <Crown className="h-3 w-3" />}
                      {role.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">You can change these later in your profile</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !firstName || !email || !password}
              className="btn-primary w-full py-3 text-[15px] mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400 dark:text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <p className="text-center py-5 text-xs text-gray-300 dark:text-gray-600">
        Worship Portal — Built for ministry teams
      </p>
    </div>
  );
}
