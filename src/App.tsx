import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Events } from './pages/Events';
import { EventDetail } from './pages/EventDetail';
import { Announcements } from './pages/Announcements';
import { AnnouncementDetail } from './pages/AnnouncementDetail';
import { Library } from './pages/Library';
import { Profile } from './pages/Profile';
import { TeamManage } from './pages/TeamManage';
import { Requests } from './pages/Requests';
import { RequestLeave } from './pages/RequestLeave';
import { Notifications } from './pages/Notifications';
import { More } from './pages/More';
import { MyAssignments } from './pages/MyAssignments';
import { UnavailableMembers } from './pages/UnavailableMembers';
import { Discipline } from './pages/Discipline';
import { LeaderDashboard } from './pages/LeaderDashboard';
import { LeadershipWorkspace } from './pages/leadership/LeadershipWorkspace';
import { ProtectedRoute } from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/landing" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
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
                  <Route path="/request-leave" element={<RequestLeave />} />
                  <Route path="/notifications" element={<Notifications />} />
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
