import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Cake, Upload, X, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { DatePicker } from '../components/DatePicker';

const inputClass = `w-full h-12 px-4 rounded-xl text-[14px]
  bg-gray-50 dark:bg-white/[0.05]
  border border-gray-200 dark:border-white/[0.08]
  text-gray-900 dark:text-white
  placeholder-gray-400 dark:placeholder-white/20
  focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50
  transition-all duration-200`;

export function Onboarding() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    first_name: profile?.first_name || '',
    second_name: profile?.second_name || '',
    middle_name: profile?.middle_name || '',
    last_name: profile?.last_name || '',
    nickname: profile?.nickname || '',
    phone: profile?.phone || '',
    gender: profile?.gender || '',
    birthday: profile?.birthday || '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url || null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('error', 'Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('error', 'Image must be less than 5MB'); return; }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeAvatar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);

    let avatarUrl = profile?.avatar_url;

    if (avatarFile) {
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile, { upsert: true });

      if (uploadError) {
        toast('error', 'Failed to upload avatar');
        setLoading(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      avatarUrl = publicUrl;
    }

    const profileUpdate: Record<string, unknown> = {
      first_name: form.first_name,
      second_name: form.second_name,
      middle_name: form.middle_name,
      last_name: form.last_name,
      nickname: form.nickname,
      phone: form.phone,
      gender: form.gender,
      is_onboarded: true,
      updated_at: new Date().toISOString(),
    };
    if (form.birthday) profileUpdate.birthday = form.birthday;
    if (avatarUrl) profileUpdate.avatar_url = avatarUrl;

    const { error: profileError } = await supabase.from('profiles').update(profileUpdate).eq('id', user.id);
    if (profileError) {
      toast('error', 'Failed to save profile');
      setLoading(false);
      return;
    }

    await refreshProfile();
    setLoading(false);
    toast('success', 'Welcome to the team!');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#0d0d0f] transition-colors duration-300">

      <div className="flex justify-center min-h-screen px-6 py-16">
        <div className="w-full max-w-[420px]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative bg-white dark:bg-white/[0.025] rounded-3xl border border-gray-200/80 dark:border-white/[0.06] p-8 shadow-[0_2px_8px_rgba(0,0,0,0.05),0_16px_48px_rgba(0,0,0,0.06)] dark:shadow-none transition-colors duration-300">
              {/* Top-edge highlight */}
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.07] dark:via-white/[0.12] to-transparent" />

              {/* Header */}
              <div className="flex items-center gap-3 mb-8">
                <img
                  src="/servesync-logo-new.png"
                  alt="ServeSync"
                  className="h-10 w-10 rounded-[22%] shadow-sm shadow-black/10 dark:shadow-black/30 shrink-0"
                />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-500/70 mb-0.5 transition-colors duration-300">
                    Profile Setup
                  </p>
                  <h1 className="text-[20px] font-bold text-gray-900 dark:text-white tracking-[-0.02em] leading-tight transition-colors duration-300">
                    Tell us about yourself
                  </h1>
                </div>
              </div>

              <div className="space-y-5">

                {/* Avatar upload */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.12em] mb-3 transition-colors duration-300">
                    Profile Photo <span className="normal-case font-normal text-gray-300 dark:text-white/20">(optional)</span>
                  </label>
                  <label className="flex items-center gap-4 cursor-pointer group">
                    <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                    <div className="relative shrink-0">
                      {avatarPreview ? (
                        <>
                          <img
                            src={avatarPreview}
                            alt="Avatar preview"
                            className="h-16 w-16 rounded-full object-cover ring-2 ring-emerald-400/40"
                          />
                          <button
                            type="button"
                            onClick={removeAvatar}
                            className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-white/[0.06] border-2 border-dashed border-gray-300 dark:border-white/[0.12] flex items-center justify-center group-hover:border-emerald-400/60 dark:group-hover:border-emerald-500/40 transition-colors duration-200">
                          <Upload className="h-5 w-5 text-gray-400 dark:text-white/20 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors duration-200" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-gray-700 dark:text-white/60 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors duration-200">
                        {avatarPreview ? 'Change photo' : 'Upload a photo'}
                      </p>
                      <p className="text-[12px] text-gray-400 dark:text-white/25 mt-0.5 transition-colors duration-300">
                        JPG, PNG or GIF · Max 5MB
                      </p>
                    </div>
                  </label>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.12em] mb-2 transition-colors duration-300">
                    I am a…
                  </label>
                  <div className="flex gap-2">
                    {(['male', 'female'] as const).map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setForm({ ...form, gender: g })}
                        className={`flex-1 h-11 rounded-xl text-[14px] font-medium transition-all duration-200 ${
                          form.gender === g
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                            : 'bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-white/40 hover:border-emerald-400/50 dark:hover:border-emerald-500/30 hover:text-emerald-600 dark:hover:text-emerald-400'
                        }`}
                      >
                        {g === 'male' ? 'Male' : 'Female'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* First + Last name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.12em] mb-2 transition-colors duration-300">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={form.first_name}
                      onChange={e => setForm({ ...form, first_name: e.target.value })}
                      className={inputClass}
                      placeholder="First"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.12em] mb-2 transition-colors duration-300">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={form.last_name}
                      onChange={e => setForm({ ...form, last_name: e.target.value })}
                      className={inputClass}
                      placeholder="Last"
                    />
                  </div>
                </div>

                {/* Second + Middle name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.12em] mb-2 transition-colors duration-300">
                      Second Name <span className="normal-case font-normal text-gray-300 dark:text-white/20">opt.</span>
                    </label>
                    <input
                      type="text"
                      value={form.second_name}
                      onChange={e => setForm({ ...form, second_name: e.target.value })}
                      className={inputClass}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.12em] mb-2 transition-colors duration-300">
                      Middle Name <span className="normal-case font-normal text-gray-300 dark:text-white/20">opt.</span>
                    </label>
                    <input
                      type="text"
                      value={form.middle_name}
                      onChange={e => setForm({ ...form, middle_name: e.target.value })}
                      className={inputClass}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                {/* Nickname */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.12em] mb-2 transition-colors duration-300">
                    Nickname <span className="normal-case font-normal text-gray-300 dark:text-white/20">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={form.nickname}
                    onChange={e => setForm({ ...form, nickname: e.target.value })}
                    className={inputClass}
                    placeholder="What should we call you?"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.12em] mb-2 transition-colors duration-300">
                    Phone <span className="normal-case font-normal text-gray-300 dark:text-white/20">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className={inputClass}
                    placeholder="Your phone number"
                  />
                </div>

                {/* Birthday */}
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-[0.12em] mb-2 transition-colors duration-300">
                    <Cake className="h-3.5 w-3.5" />
                    Birthday <span className="normal-case font-normal text-gray-300 dark:text-white/20">(optional)</span>
                  </label>
                  <DatePicker value={form.birthday} onChange={v => setForm({ ...form, birthday: v })} placeholder="Select your birthday" />
                </div>

                {/* Info note */}
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/[0.07] border border-emerald-100 dark:border-emerald-500/[0.12] transition-colors duration-300">
                  <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[13px] text-emerald-700 dark:text-emerald-300/80 leading-relaxed transition-colors duration-300">
                    Ministry roles and church access are assigned by your church admin after you join.
                  </p>
                </div>

                {/* Submit */}
                <div className="pt-1">
                  <button
                    onClick={handleFinish}
                    disabled={loading || !form.first_name}
                    className="w-full h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20"
                  >
                    {loading
                      ? <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Setting up…</>
                      : <>Get Started <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </div>

              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
