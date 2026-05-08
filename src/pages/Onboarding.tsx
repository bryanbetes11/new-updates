import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Cake, Upload, X, ChevronLeft, Music } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { DatePicker } from '../components/DatePicker';

export function Onboarding() {
  const { user, profile, roles, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
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
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url || null);

  const totalSteps = 2;

  const toggleRole = (roleId: string) => {
    setSelectedRoles(prev =>
      prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]
    );
  };

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

  const removeAvatar = () => {
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

    if (selectedRoles.length > 0) {
      await supabase.from('user_roles').insert(selectedRoles.map(role_id => ({ user_id: user.id, role_id })));
    }

    await refreshProfile();
    setLoading(false);
    toast('success', 'Welcome to the team!');
    navigate('/dashboard');
  };

  const stepTitles = ['Tell us about yourself', 'Select your roles'];
  const stepSubs = ['Set up your profile details', 'Choose your ministry roles'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-7">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <img
                  src="/Applogo.png"
                  alt="Worship Portal"
                  className="h-12 w-12 rounded-[22%] shadow-lg shadow-black/10 dark:shadow-black/30"
                />
                <div className="absolute -bottom-1 -right-1 flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500 ring-2 ring-gray-50 dark:ring-[#0a0a0a]">
                  <Music className="h-2.5 w-2.5 text-white" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className="flex-1 flex items-center gap-1.5">
                  <div
                    className={`h-1.5 flex-1 rounded-full transition-all duration-400 ${
                      i < step ? 'bg-emerald-500' : i === step ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                  {i < totalSteps - 1 && null}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                Step {step + 1} of {totalSteps}
              </span>
            </div>
            <h1 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">{stepTitles[step]}</h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{stepSubs[step]}</p>
          </div>

          <div className="space-y-4">
            {step === 0 && (
              <>
                <div>
                  <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-2">Profile Picture <span className="font-normal text-gray-400">(optional)</span></label>
                  <div className="flex items-center gap-3">
                    {avatarPreview ? (
                      <div className="relative shrink-0">
                        <img
                          src={avatarPreview}
                          alt="Avatar preview"
                          className="h-16 w-16 rounded-full object-cover ring-2 ring-emerald-200 dark:ring-emerald-800"
                        />
                        <button
                          type="button"
                          onClick={removeAvatar}
                          className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-[#232325] flex items-center justify-center ring-2 ring-gray-200 dark:ring-gray-700 shrink-0">
                        <Upload className="h-6 w-6 text-gray-300 dark:text-gray-600" />
                      </div>
                    )}
                    <label className="flex-1 cursor-pointer">
                      <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                      <div className="btn-secondary text-center text-sm py-2">
                        {avatarPreview ? 'Change Photo' : 'Upload Photo'}
                      </div>
                    </label>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Max 5MB. JPG, PNG, or GIF.</p>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">I am a...</label>
                  <div className="flex gap-2">
                    {(['male', 'female'] as const).map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setForm({ ...form, gender: g })}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ring-1 ${
                          form.gender === g
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-emerald-300 dark:ring-emerald-700 text-emerald-700 dark:text-emerald-300'
                            : 'bg-white dark:bg-[#232325] ring-gray-200 dark:ring-gray-700 text-gray-600 dark:text-gray-400 hover:ring-gray-300'
                        }`}
                      >
                        {g === 'male' ? 'Brother' : 'Sister'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">First Name</label>
                    <input
                      type="text"
                      value={form.first_name}
                      onChange={e => setForm({ ...form, first_name: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Last Name</label>
                    <input
                      type="text"
                      value={form.last_name}
                      onChange={e => setForm({ ...form, last_name: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Second Name <span className="font-normal text-gray-400 text-[11px]">opt.</span></label>
                    <input
                      type="text"
                      value={form.second_name}
                      onChange={e => setForm({ ...form, second_name: e.target.value })}
                      className="input-field"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Middle Name <span className="font-normal text-gray-400 text-[11px]">opt.</span></label>
                    <input
                      type="text"
                      value={form.middle_name}
                      onChange={e => setForm({ ...form, middle_name: e.target.value })}
                      className="input-field"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Nickname <span className="font-normal text-gray-400">(optional)</span></label>
                  <input
                    type="text"
                    value={form.nickname}
                    onChange={e => setForm({ ...form, nickname: e.target.value })}
                    className="input-field"
                    placeholder="What should we call you?"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Phone <span className="font-normal text-gray-400">(optional)</span></label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="input-field"
                    placeholder="Your phone number"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    <span className="flex items-center gap-1.5"><Cake className="h-3.5 w-3.5" /> Birthday <span className="font-normal text-gray-400">(optional)</span></span>
                  </label>
                  <DatePicker value={form.birthday} onChange={v => setForm({ ...form, birthday: v })} placeholder="Select your birthday" />
                </div>
              </>
            )}

            {step === 1 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
                  Choose the roles that apply to you. You can change these later in your profile.
                </p>
                {roles.map(role => (
                  <button
                    key={role.id}
                    onClick={() => toggleRole(role.id)}
                    className={`flex w-full items-center gap-3 rounded-xl p-3.5 text-left transition-all duration-150 ring-1 ${
                      selectedRoles.includes(role.id)
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-emerald-300 dark:ring-emerald-700 text-emerald-900 dark:text-emerald-100'
                        : 'bg-white dark:bg-[#1a1a1c] ring-black/[0.05] dark:ring-white/[0.06] text-gray-700 dark:text-gray-300 hover:ring-gray-300 dark:hover:ring-gray-600'
                    }`}
                  >
                    <div className={`flex h-5 w-5 items-center justify-center rounded-md shrink-0 transition-colors ${
                      selectedRoles.includes(role.id)
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-100 dark:bg-[#232325]'
                    }`}>
                      {selectedRoles.includes(role.id) && <Check className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{role.name}</p>
                      {role.is_leadership && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Leadership role</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mt-7">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="btn-secondary flex items-center gap-1.5 px-4 py-2.5"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            )}
            {step < totalSteps - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!form.first_name}
                className="btn-primary flex-1 py-3 text-[15px]"
              >
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={loading}
                className="btn-primary flex-1 py-3 text-[15px]"
              >
                {loading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Setting up...
                  </span>
                ) : (
                  <span className="flex items-center gap-2 justify-center">
                    Get Started <ChevronRight className="h-4 w-4" />
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-center py-5 text-xs text-gray-300 dark:text-gray-600">
        Worship Portal — Built for ministry teams
      </p>
    </div>
  );
}
