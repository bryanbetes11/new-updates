import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { InviteAccept } from './pages/InviteAccept';
import { CreateChurch } from './pages/CreateChurch';
import { PlatformPortal } from './pages/PlatformPortal';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Events } from './pages/Events';
import { EventDetail } from './pages/EventDetail';
import { Announcements } from './pages/Announcements';
import { AnnouncementDetail } from './pages/AnnouncementDetail';
import { Library } from './pages/Library';
import { Profile } from './pages/Profile';
import { RequestLeave } from './pages/RequestLeave';
import { Notifications } from './pages/Notifications';
import { More } from './pages/More';
import { Messages } from './pages/Messages';
import { MyAssignments } from './pages/MyAssignments';
import { UnavailableMembers } from './pages/UnavailableMembers';
import { Discipline } from './pages/Discipline';
import { LeadershipWorkspace } from './pages/leadership/LeadershipWorkspace';
import { ChangePassword } from './pages/ChangePassword';
import { ResetPassword } from './pages/ResetPassword';
import { ProtectedRoute } from './components/ProtectedRoute';
import { isPasswordRecoveryUrl, recoveryRedirectPath } from './lib/authRedirect';
import { AppUpdateModal } from './components/AppUpdateModal';
import { APP_UPDATE_VERSION, APP_VERSION_LABEL } from './lib/appUpdate';
import {
  APP_UPDATE_AVAILABLE_EVENT,
  applyPendingAppUpdate,
  getInstalledAppVersion,
  hasPendingAppUpdate,
  shouldRequireAppUpdate,
} from './lib/serviceWorkerUpdate';

function PasswordRecoveryRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === '/reset-password') return;
    if (!isPasswordRecoveryUrl(location.search, location.hash)) return;
    navigate(recoveryRedirectPath(location.search, location.hash), { replace: true });
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}

export default function App() {
  const [showAppUpdate, setShowAppUpdate] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);

  useEffect(() => {
    const handleUpdateAvailable = () => {
      setInstalledVersion(getInstalledAppVersion());
      setShowAppUpdate(shouldRequireAppUpdate());
    };

    window.addEventListener(APP_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);

    setInstalledVersion(getInstalledAppVersion());
    if (hasPendingAppUpdate() && shouldRequireAppUpdate()) setShowAppUpdate(true);

    return () => window.removeEventListener(APP_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);
  }, []);

  return (
    <BrowserRouter>
      <PasswordRecoveryRedirect />
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AppUpdateModal
              open={showAppUpdate}
              currentVersion={installedVersion || APP_VERSION_LABEL}
              targetVersion={APP_UPDATE_VERSION}
              onUpdate={() => {
                setApplyingUpdate(true);
                applyPendingAppUpdate();
              }}
              applying={applyingUpdate}
            />
            <Routes>
              <Route path="/platform" element={<PlatformPortal />} />
              <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/landing" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/register" element={<Register />} />
                <Route path="/invite/:token" element={<InviteAccept />} />
                <Route path="/create-church" element={<CreateChurch />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/events" element={<Events />} />
                  <Route path="/events/:id" element={<EventDetail />} />
                  <Route path="/announcements" element={<Announcements />} />
                  <Route path="/announcements/:id" element={<AnnouncementDetail />} />
                  <Route path="/library" element={<Library />} />
                  <Route path="/my-assignments" element={<MyAssignments />} />
                  <Route path="/unavailable-members" element={<UnavailableMembers />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/change-password" element={<ChangePassword />} />
                  <Route path="/request-leave" element={<RequestLeave />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/messages/:conversationId?" element={<Messages />} />
                  <Route path="/more" element={<More />} />
                  <Route path="/leadership" element={<Navigate to="/leadership/overview" replace />} />
                  <Route path="/leadership/:tab" element={<LeadershipWorkspace />} />

                  <Route path="/leader" element={<Navigate to="/leadership/overview" replace />} />
                  <Route path="/manage" element={<Navigate to="/leadership/team" replace />} />
                  <Route path="/requests" element={<Navigate to="/leadership/leave" replace />} />
                  <Route path="/discipline" element={<Discipline />} />
                </Route>
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Route>
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
