import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Cake, Upload, X, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { DatePicker } from '../components/DatePicker';
import { LaunchFlowShell } from '../components/LaunchFlowShell';
import { launchInfoRowClass, launchInputClass, launchPrimaryButtonClass } from '../lib/launchFlowStyles';

const steps = [
  { label: 'Church invite', detail: 'Join the correct private workspace' },
  { label: 'Member account', detail: 'Secure your ServeSync access' },
  { label: 'Your profile', detail: 'Share the details your team needs' },
];

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
    <LaunchFlowShell
      eyebrow="Member setup"
      title="Make your profile useful on service day."
      description="Add only the details your leaders need for scheduling, communication, birthdays, and ministry coordination. Your church controls roles separately."
      steps={steps}
      currentStep={2}
    >
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-8">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#63ee91]">Step 3 of 3</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">Tell your team who you are</h2>
          <p className="mt-3 text-sm leading-6 text-white/48">You can update these details later from your profile.</p>
        </div>

              <div className="space-y-5">

                {/* Avatar upload */}
                <div>
                  <label className="mb-3 block text-[11px] font-black uppercase tracking-[0.14em] text-white/36">
                    Profile photo <span className="normal-case font-semibold tracking-normal text-white/22">optional</span>
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
                        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-white/[0.13] bg-white/[0.055] transition-colors group-hover:border-[#1ed760]/60">
                          <Upload className="h-5 w-5 text-white/24 transition-colors group-hover:text-[#63ee91]" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[13px] font-black text-white/68 transition-colors group-hover:text-[#63ee91]">
                        {avatarPreview ? 'Change photo' : 'Upload a photo'}
                      </p>
                      <p className="mt-0.5 text-[12px] text-white/28">
                        JPG, PNG or GIF · Max 5MB
                      </p>
                    </div>
                  </label>
                </div>

                {/* Gender */}
                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-white/36">
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
                            ? 'bg-[#1ed760] text-black'
                            : 'border border-white/[0.09] bg-white/[0.055] text-white/45 hover:border-[#1ed760]/45 hover:text-white/75'
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
                    <label htmlFor="onboarding-first-name" className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-white/36">
                      First Name
                    </label>
                    <input
                      id="onboarding-first-name"
                      type="text"
                      value={form.first_name}
                      onChange={e => setForm({ ...form, first_name: e.target.value })}
                      className={launchInputClass}
                      placeholder="First"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="onboarding-last-name" className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-white/36">
                      Last Name
                    </label>
                    <input
                      id="onboarding-last-name"
                      type="text"
                      value={form.last_name}
                      onChange={e => setForm({ ...form, last_name: e.target.value })}
                      className={launchInputClass}
                      placeholder="Last"
                    />
                  </div>
                </div>

                {/* Second + Middle name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="onboarding-second-name" className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-white/36">
                      Second name <span className="normal-case font-semibold tracking-normal text-white/22">optional</span>
                    </label>
                    <input
                      id="onboarding-second-name"
                      type="text"
                      value={form.second_name}
                      onChange={e => setForm({ ...form, second_name: e.target.value })}
                      className={launchInputClass}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label htmlFor="onboarding-middle-name" className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-white/36">
                      Middle name <span className="normal-case font-semibold tracking-normal text-white/22">optional</span>
                    </label>
                    <input
                      id="onboarding-middle-name"
                      type="text"
                      value={form.middle_name}
                      onChange={e => setForm({ ...form, middle_name: e.target.value })}
                      className={launchInputClass}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                {/* Nickname */}
                <div>
                  <label htmlFor="onboarding-nickname" className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-white/36">
                    Nickname <span className="normal-case font-semibold tracking-normal text-white/22">optional</span>
                  </label>
                  <input
                    id="onboarding-nickname"
                    type="text"
                    value={form.nickname}
                    onChange={e => setForm({ ...form, nickname: e.target.value })}
                    className={launchInputClass}
                    placeholder="What should we call you?"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="onboarding-phone" className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em] text-white/36">
                    Phone <span className="normal-case font-semibold tracking-normal text-white/22">optional</span>
                  </label>
                  <input
                    id="onboarding-phone"
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className={launchInputClass}
                    placeholder="Your phone number"
                  />
                </div>

                {/* Birthday */}
                <div>
                  <label className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-white/36">
                    <Cake className="h-3.5 w-3.5" />
                    Birthday <span className="normal-case font-semibold tracking-normal text-white/22">optional</span>
                  </label>
                  <DatePicker value={form.birthday} onChange={v => setForm({ ...form, birthday: v })} placeholder="Select your birthday" />
                </div>

                {/* Info note */}
                <div className={launchInfoRowClass}>
                  <Shield className="mt-1 h-4 w-4 shrink-0 text-[#63ee91]" />
                  <p>
                    Ministry roles and church access are assigned by your church admin after you join.
                  </p>
                </div>

                {/* Submit */}
                <div className="pt-1">
                  <button
                    onClick={handleFinish}
                    disabled={loading || !form.first_name}
                    className={`${launchPrimaryButtonClass} w-full`}
                  >
                    {loading
                      ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />Setting up…</>
                      : <>Get Started <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </div>

              </div>
      </div>
    </LaunchFlowShell>
  );
}
