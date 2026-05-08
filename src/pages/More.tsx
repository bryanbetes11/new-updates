import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  User, Users, Bell, LogOut, Shield, Library, Calendar, ClipboardCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { Avatar } from '../components/Avatar';
import { AttendanceGuideModal } from '../components/AttendanceGuideModal';
import { LeaveRequestModal } from '../components/LeaveRequestModal';
import { useUnreadCounts } from '../hooks/useUnreadCounts';

export function More() {
  const { profile, isLeader, signOut } = useAuth();
  const navigate = useNavigate();
  const unread = useUnreadCounts();
  const [showRequestLeave, setShowRequestLeave] = useState(false);
  const [showAttendanceGuide, setShowAttendanceGuide] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const menuItems = [
    { icon: Library, label: 'Library', desc: 'Browse songs and setlists', path: '/library', show: true, action: null, badge: 0 },
    { icon: Calendar, label: 'Request Leave', desc: 'Submit unavailability request', path: null, show: true, action: () => setShowRequestLeave(true), badge: 0 },
    { icon: ClipboardCheck, label: 'Attendance Guide', desc: 'How attendance tracking works', path: null, show: true, action: () => setShowAttendanceGuide(true), badge: 0 },
    { icon: User, label: 'Profile', desc: 'Edit your info and avatar', path: '/profile', show: true, action: null, badge: 0 },
    { icon: Bell, label: 'Notifications', desc: 'View your notifications', path: '/notifications', show: true, action: null, badge: 0 },
    { icon: Users, label: 'Leadership', desc: 'Team management tools', path: '/leadership/overview', show: isLeader, action: null, badge: unread.pendingLeave },
  ].filter(item => item.show);

  const displayName = profile?.nickname || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();

  return (
    <div className="page-container page-bottom-pad">
      <div className="px-4 sm:px-5 lg:px-6 pt-6 sm:pt-7 pb-4 space-y-5">

        {/* Profile card */}
        <div className="card p-5 animate-fade-in">
          <div className="flex items-center gap-4">
            <Avatar
              src={profile?.avatar_url}
              firstName={profile?.first_name || '?'}
              lastName={profile?.last_name}
              size="lg"
              className="rounded-2xl shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h1 className="text-[17px] font-black text-gray-900 dark:text-white truncate leading-tight" style={{ letterSpacing: '-0.025em' }}>
                {displayName}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{profile?.email}</p>
              {isLeader && (
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-950/40">
                    <Shield className="h-3 w-3 text-brand-600 dark:text-brand-400" />
                    <span className="text-[11px] font-bold text-brand-700 dark:text-brand-300" style={{ letterSpacing: '0.02em' }}>Leader</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <div className="hidden lg:block"><ThemeToggle /></div>
              <button
                onClick={handleSignOut}
                className="p-2.5 rounded-xl text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 active:scale-95 transition-all duration-150"
                title="Sign Out"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </div>

        {/* Menu grid */}
        <div className="grid grid-cols-2 gap-3 animate-slide-up">
          {menuItems.map((item, index) => (
            <button
              key={item.path || index}
              onClick={() => item.action ? item.action() : navigate(item.path!)}
              className="card p-4 text-left group transition-all duration-150 hover:ring-black/[0.09] dark:hover:ring-white/[0.11] active:scale-[0.98]"
              style={{ '--hover-shadow': '0 6px 20px rgba(0,0,0,0.09)' } as React.CSSProperties}
            >
              <div className="flex flex-col items-start gap-3">
                <div className="relative flex items-center justify-center h-11 w-11 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 group-hover:bg-brand-100 dark:group-hover:bg-brand-950/60 transition-colors shrink-0">
                  <item.icon className="h-5 w-5" />
                  {item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none shadow-sm">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-gray-900 dark:text-white leading-tight" style={{ letterSpacing: '-0.02em' }}>{item.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug mt-0.5">{item.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <AttendanceGuideModal open={showAttendanceGuide} onClose={() => setShowAttendanceGuide(false)} />
      <LeaveRequestModal open={showRequestLeave} onClose={() => setShowRequestLeave(false)} />
    </div>
  );
}
