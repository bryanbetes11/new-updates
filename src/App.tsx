import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { Layout } from "./components/Layout";
import { PageLoader } from "./components/LoadingSpinner";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SurveyGate } from "./components/SurveyGate";
import { InteractiveLabelCase } from "./components/InteractiveLabelCase";
import {
  isPasswordRecoveryUrl,
  recoveryRedirectPath,
} from "./lib/authRedirect";
import { AppUpdateModal } from "./components/AppUpdateModal";
import { APP_UPDATE_VERSION, APP_VERSION_LABEL } from "./lib/appUpdate";
import {
  APP_UPDATE_AVAILABLE_EVENT,
  applyPendingAppUpdate,
  getInstalledAppVersion,
  hasPendingAppUpdate,
  shouldRequireAppUpdate,
} from "./lib/serviceWorkerUpdate";
import {
  clearActiveServiceMode,
  getActiveServiceMode,
  serviceModeResumePath,
} from "./lib/serviceModeResume";

const Login = lazy(() =>
  import("./pages/Login").then(({ Login }) => ({ default: Login })),
);
const Register = lazy(() =>
  import("./pages/Register").then(({ Register }) => ({ default: Register })),
);
const InviteAccept = lazy(() =>
  import("./pages/InviteAccept").then(({ InviteAccept }) => ({
    default: InviteAccept,
  })),
);
const PlatformActivityLog = lazy(() =>
  import("./pages/PlatformActivityLog").then(({ PlatformActivityLog }) => ({
    default: PlatformActivityLog,
  })),
);
const Onboarding = lazy(() =>
  import("./pages/Onboarding").then(({ Onboarding }) => ({
    default: Onboarding,
  })),
);
const Dashboard = lazy(() =>
  import("./pages/Dashboard").then(({ Dashboard }) => ({ default: Dashboard })),
);
const Events = lazy(() =>
  import("./pages/Events").then(({ Events }) => ({ default: Events })),
);
const EventDetail = lazy(() =>
  import("./pages/EventDetail").then(({ EventDetail }) => ({
    default: EventDetail,
  })),
);
const AttendanceQrScanner = lazy(() =>
  import("./pages/AttendanceQrScanner").then(({ AttendanceQrScanner }) => ({
    default: AttendanceQrScanner,
  })),
);
const AttendanceQrPilot = lazy(() =>
  import("./pages/AttendanceQrPilot").then(({ AttendanceQrPilot }) => ({
    default: AttendanceQrPilot,
  })),
);
const Announcements = lazy(() =>
  import("./pages/Announcements").then(({ Announcements }) => ({
    default: Announcements,
  })),
);
const AnnouncementCreate = lazy(() =>
  import("./pages/AnnouncementCreate").then(({ AnnouncementCreate }) => ({
    default: AnnouncementCreate,
  })),
);
const AnnouncementDetail = lazy(() =>
  import("./pages/AnnouncementDetail").then(({ AnnouncementDetail }) => ({
    default: AnnouncementDetail,
  })),
);
const Library = lazy(() =>
  import("./pages/Library").then(({ Library }) => ({ default: Library })),
);
const Songs = lazy(() =>
  import("./pages/Songs").then(({ Songs }) => ({ default: Songs })),
);
const Videos = lazy(() =>
  import("./pages/Videos").then(({ Videos }) => ({ default: Videos })),
);
const Sets = lazy(() =>
  import("./pages/Sets").then(({ Sets }) => ({ default: Sets })),
);
const Profile = lazy(() =>
  import("./pages/Profile").then(({ Profile }) => ({ default: Profile })),
);
const RequestLeave = lazy(() =>
  import("./pages/RequestLeave").then(({ RequestLeave }) => ({
    default: RequestLeave,
  })),
);
const Notifications = lazy(() =>
  import("./pages/Notifications").then(({ Notifications }) => ({
    default: Notifications,
  })),
);
const Messages = lazy(() =>
  import("./pages/Messages").then(({ Messages }) => ({ default: Messages })),
);
const MyAssignments = lazy(() =>
  import("./pages/MyAssignments").then(({ MyAssignments }) => ({
    default: MyAssignments,
  })),
);
const UnavailableMembers = lazy(() =>
  import("./pages/UnavailableMembers").then(({ UnavailableMembers }) => ({
    default: UnavailableMembers,
  })),
);
const LeaderDashboard = lazy(() =>
  import("./pages/LeaderDashboard").then(({ LeaderDashboard }) => ({
    default: LeaderDashboard,
  })),
);
const TeamManage = lazy(() =>
  import("./pages/TeamManage").then(({ TeamManage }) => ({
    default: TeamManage,
  })),
);
const Accountability = lazy(() =>
  import("./pages/Accountability").then(({ Accountability }) => ({
    default: Accountability,
  })),
);
const Requests = lazy(() =>
  import("./pages/Requests").then(({ Requests }) => ({ default: Requests })),
);
const SwapRequests = lazy(() =>
  import("./pages/SwapRequests").then(({ SwapRequests }) => ({
    default: SwapRequests,
  })),
);
const SetlistDeadlines = lazy(() =>
  import("./pages/leadership/SetlistDeadlines").then(
    ({ SetlistDeadlines }) => ({ default: SetlistDeadlines }),
  ),
);
const OrganizationSettings = lazy(() =>
  import("./pages/leadership/OrganizationSettings").then(
    ({ OrganizationSettings }) => ({ default: OrganizationSettings }),
  ),
);
const OrganizationBilling = lazy(() =>
  import("./pages/leadership/OrganizationBilling").then(
    ({ OrganizationBilling }) => ({ default: OrganizationBilling }),
  ),
);
const NotificationSettings = lazy(() =>
  import("./pages/leadership/NotificationSettings").then(
    ({ NotificationSettings }) => ({ default: NotificationSettings }),
  ),
);
const SurveyManagement = lazy(() =>
  import("./pages/leadership/SurveyManagement").then(
    ({ SurveyManagement }) => ({ default: SurveyManagement }),
  ),
);
const MinistryReflection = lazy(() =>
  import("./pages/MinistryReflection").then(({ MinistryReflection }) => ({
    default: MinistryReflection,
  })),
);
const ChangePassword = lazy(() =>
  import("./pages/ChangePassword").then(({ ChangePassword }) => ({
    default: ChangePassword,
  })),
);
const ResetPassword = lazy(() =>
  import("./pages/ResetPassword").then(({ ResetPassword }) => ({
    default: ResetPassword,
  })),
);
const AuthConfirm = lazy(() =>
  import("./pages/AuthConfirm").then(({ AuthConfirm }) => ({
    default: AuthConfirm,
  })),
);

function RouteLoadingBoundary() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  );
}

function PasswordRecoveryRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === "/reset-password") return;
    if (!isPasswordRecoveryUrl(location.search, location.hash)) return;
    navigate(recoveryRedirectPath(location.search, location.hash), {
      replace: true,
    });
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}

function ServiceModeResumeRedirect() {
  const location = useLocation();
  const navigate = useNavigate();
  const { loading, isOrgAdmin, isAdmin, isPlatformOwner } = useAuth();
  const hasTriedServiceModeResume = useRef(false);
  const canUseServiceModePilot = isOrgAdmin || isAdmin || isPlatformOwner;

  useEffect(() => {
    if (loading || hasTriedServiceModeResume.current) return;
    hasTriedServiceModeResume.current = true;

    if (!canUseServiceModePilot) {
      clearActiveServiceMode();
      return;
    }

    const restoreServiceMode = () => {
      const activeMode = getActiveServiceMode();
      if (!activeMode) return;

      const target = serviceModeResumePath(activeMode);
      const current = `${location.pathname}${location.search}`;
      if (current === target) return;
      if (location.pathname === `/events/${activeMode.eventId}`) {
        const params = new URLSearchParams(location.search);
        const mode = params.get("mode");
        if (mode === "service" || mode === "rehearsal" || mode === "restore")
          return;
      }

      navigate(target, { replace: true });
    };

    restoreServiceMode();
  }, [canUseServiceModePilot, loading, location.pathname, location.search, navigate]);

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
    if (hasPendingAppUpdate() && shouldRequireAppUpdate())
      setShowAppUpdate(true);

    return () =>
      window.removeEventListener(
        APP_UPDATE_AVAILABLE_EVENT,
        handleUpdateAvailable,
      );
  }, []);

  return (
    <BrowserRouter>
      <InteractiveLabelCase />
      <PasswordRecoveryRedirect />
      <ThemeProvider>
        <AuthProvider>
          <ServiceModeResumeRedirect />
          <ToastProvider>
            <AppUpdateModal
              open={showAppUpdate}
              currentVersion={installedVersion || APP_VERSION_LABEL}
              targetVersion={APP_UPDATE_VERSION}
              onUpdate={() => {
                setApplyingUpdate(true);
                void applyPendingAppUpdate();
              }}
              applying={applyingUpdate}
            />
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route
                path="/platform"
                element={<Navigate to="/activity-log" replace />}
              />
              <Route
                path="/platform/activity"
                element={<Navigate to="/activity-log" replace />}
              />
              <Route element={<Layout />}>
                <Route element={<RouteLoadingBoundary />}>
                  <Route
                    path="/landing"
                    element={<Navigate to="/login" replace />}
                  />
                  <Route path="/login" element={<Login />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/auth/confirm" element={<AuthConfirm />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/invite/:token" element={<InviteAccept />} />
                  <Route
                    path="/create-church"
                    element={<Navigate to="/login" replace />}
                  />
                  <Route element={<ProtectedRoute />}>
                    <Route path="/onboarding" element={<Onboarding />} />
                    <Route
                      path="/reflection"
                      element={<MinistryReflection />}
                    />
                    <Route element={<SurveyGate />}>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route
                        path="/activity-log"
                        element={<PlatformActivityLog />}
                      />
                      <Route path="/events" element={<Events />} />
                      <Route path="/events/:id" element={<EventDetail />} />
                      <Route path="/attendance/scan" element={<AttendanceQrScanner />} />
                      <Route
                        path="/announcements"
                        element={<Announcements />}
                      />
                      <Route
                        path="/announcements/new"
                        element={<AnnouncementCreate />}
                      />
                      <Route
                        path="/announcements/:id"
                        element={<AnnouncementDetail />}
                      />
                      <Route path="/library" element={<Library />} />
                      <Route path="/songs" element={<Songs />} />
                      <Route path="/videos" element={<Videos />} />
                      <Route path="/sets" element={<Sets />} />
                      <Route
                        path="/approve-setlist"
                        element={<Navigate to="/leadership/setlists" replace />}
                      />
                      <Route
                        path="/my-assignments"
                        element={<MyAssignments />}
                      />
                      <Route
                        path="/unavailable-members"
                        element={<UnavailableMembers />}
                      />
                      <Route path="/profile" element={<Profile />} />
                      <Route
                        path="/change-password"
                        element={<ChangePassword />}
                      />
                      <Route path="/request-leave" element={<RequestLeave />} />
                      <Route
                        path="/notifications"
                        element={<Notifications />}
                      />
                      <Route
                        path="/messages/:conversationId?"
                        element={<Messages />}
                      />
                      <Route path="/more" element={<Navigate to="/dashboard" replace />} />
                      <Route
                        path="/leadership"
                        element={<Navigate to="/leadership/overview" replace />}
                      />
                      <Route
                        path="/leadership/overview"
                        element={<LeaderDashboard />}
                      />
                      <Route
                        path="/leadership/setlists"
                        element={<SetlistDeadlines />}
                      />
                      <Route path="/leadership/leave" element={<Requests />} />
                      <Route
                        path="/leadership/swaps"
                        element={<SwapRequests />}
                      />
                      <Route
                        path="/leadership/discipline"
                        element={<Navigate to="/leadership/accountability?tab=conduct" replace />}
                      />
                      <Route path="/leadership/team" element={<TeamManage />} />
                      <Route path="/leadership/accountability" element={<Accountability />} />
                      <Route path="/leadership/attendance-qr" element={<AttendanceQrPilot />} />
                      <Route
                        path="/leadership/attendance-qr-pilot"
                        element={<Navigate to="/leadership/attendance-qr" replace />}
                      />
                      <Route
                        path="/leadership/church"
                        element={<OrganizationSettings />}
                      />
                      <Route
                        path="/leadership/billing"
                        element={<OrganizationBilling />}
                      />
                      <Route
                        path="/leadership/notifications"
                        element={<NotificationSettings />}
                      />
                      <Route
                        path="/leadership/surveys"
                        element={<SurveyManagement />}
                      />

                      <Route
                        path="/leader"
                        element={<Navigate to="/leadership/overview" replace />}
                      />
                      <Route
                        path="/manage"
                        element={<Navigate to="/leadership/team" replace />}
                      />
                      <Route
                        path="/requests"
                        element={<Navigate to="/leadership/leave" replace />}
                      />
                      <Route path="/discipline" element={<Navigate to="/leadership/accountability?tab=conduct" replace />} />
                    </Route>
                  </Route>
                  <Route path="*" element={<Navigate to="/login" replace />} />
                </Route>
              </Route>
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
