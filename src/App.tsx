import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { Layout } from "./components/Layout";
import { PageLoader } from "./components/LoadingSpinner";
import { StartupScreen } from "./components/StartupScreen";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SurveyGate } from "./components/SurveyGate";
import { InteractiveLabelCase } from "./components/InteractiveLabelCase";
import {
  isPasswordRecoveryUrl,
  recoveryRedirectPath,
} from "./lib/authRedirect";
import { AppUpdateModal } from "./components/AppUpdateModal";
import { ReleaseNotesModal } from "./components/ReleaseNotesModal";
import { DailyUpdateCheckModal, type DailyUpdateCheckStatus } from "./components/DailyUpdateCheckModal";
import {
  APP_DAILY_UPDATE_CHECK_KEY,
  APP_BUILD_NUMBER,
  APP_RELEASE_HEADLINE,
  APP_RELEASE_HIGHLIGHTS,
  APP_RELEASE_NOTES_ID,
  APP_RELEASE_NOTES_SEEN_KEY,
  APP_VERSION,
  APP_VERSION_LABEL,
} from "./lib/appUpdate";
import {
  APP_UPDATE_AVAILABLE_EVENT,
  applyPendingAppUpdate,
  checkForAppUpdate,
  getInstalledAppVersion,
  getPendingAppUpdate,
  hasPendingAppUpdate,
  type PendingAppUpdate,
} from "./lib/serviceWorkerUpdate";
import { getLastAppRoute, isRememberableAppRoute, rememberLastAppRoute } from "./lib/appStartup";
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
const SoundSettings = lazy(() =>
  import("./pages/SoundSettings").then(({ SoundSettings }) => ({ default: SoundSettings })),
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
const AdminSettings = lazy(() =>
  import("./pages/leadership/AdminSettings").then(
    ({ AdminSettings }) => ({ default: AdminSettings }),
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

const LONG_BACKGROUND_THRESHOLD_MS = 30 * 60 * 1000;

function getBrowserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function StartupGate({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  const [minimumDisplayElapsed, setMinimumDisplayElapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumDisplayElapsed(true), 450);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading || !minimumDisplayElapsed) return <StartupScreen />;
  return children;
}

function RootRedirect() {
  const { user } = useAuth();
  const storage = getBrowserStorage();
  const target = user && storage ? getLastAppRoute(storage, user.id) : user ? "/dashboard" : "/login";
  return <Navigate to={target} replace />;
}

function LoginRoute() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Login />;

  const redirect = new URLSearchParams(location.search).get("redirect");
  const storage = getBrowserStorage();
  const fallback = storage ? getLastAppRoute(storage, user.id) : "/dashboard";
  return <Navigate to={redirect && isRememberableAppRoute(redirect) ? redirect : fallback} replace />;
}

function LastRouteTracker() {
  const { user, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (loading || !user) return;
    const storage = getBrowserStorage();
    if (!storage) return;
    rememberLastAppRoute(storage, user.id, `${location.pathname}${location.search}`);
  }, [loading, location.pathname, location.search, user]);

  return null;
}

function ReleaseNotesExperience({ suppressed }: { suppressed: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const storage = getBrowserStorage();
    if (!storage || storage.getItem(APP_RELEASE_NOTES_SEEN_KEY) !== APP_RELEASE_NOTES_ID) setOpen(true);
  }, [user]);

  const close = () => {
    getBrowserStorage()?.setItem(APP_RELEASE_NOTES_SEEN_KEY, APP_RELEASE_NOTES_ID);
    setOpen(false);
  };

  return <ReleaseNotesModal open={open && !suppressed} onClose={close} />;
}

function getLocalDateKey() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function DailyUpdateCheckExperience({ suppressed }: { suppressed: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<DailyUpdateCheckStatus>("checking");
  const [latestVersion, setLatestVersion] = useState<string>();
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const attemptedDateRef = useRef<string | null>(null);

  const runDailyCheck = useCallback(async (showCheckingState = true) => {
    if (showCheckingState) {
      setStatus("checking");
      setOpen(true);
    }

    const result = await checkForAppUpdate();
    const storage = getBrowserStorage();
    if (result.status === "up-to-date") {
      storage?.setItem(APP_DAILY_UPDATE_CHECK_KEY, getLocalDateKey());
      setStatus("current");
      setOpen(showCheckingState);
      return;
    }
    if (result.status === "available") {
      storage?.setItem(APP_DAILY_UPDATE_CHECK_KEY, getLocalDateKey());
      setLatestVersion(result.manifest.version);
      setStatus("available");
      setOpen(showCheckingState);
      return;
    }

    setStatus("error");
    setOpen(showCheckingState);
  }, []);

  const checkIfDue = useCallback(() => {
    if (!user) return;
    const storage = getBrowserStorage();
    const today = getLocalDateKey();
    if (storage?.getItem(APP_DAILY_UPDATE_CHECK_KEY) === today || attemptedDateRef.current === today) return;

    attemptedDateRef.current = today;
    const releaseNotesSeen = storage?.getItem(APP_RELEASE_NOTES_SEEN_KEY) === APP_RELEASE_NOTES_ID;
    void runDailyCheck(releaseNotesSeen);
  }, [runDailyCheck, user]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(checkIfDue, 900);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkIfDue();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [checkIfDue, user]);

  return (
    <>
      <DailyUpdateCheckModal
        open={open && !suppressed}
        status={status}
        latestVersion={latestVersion}
        onClose={() => setOpen(false)}
        onRetry={() => void runDailyCheck(true)}
        onViewReleaseNotes={() => {
          setOpen(false);
          setReleaseNotesOpen(true);
        }}
      />
      <ReleaseNotesModal open={releaseNotesOpen && !suppressed} onClose={() => setReleaseNotesOpen(false)} />
    </>
  );
}

const BACKGROUND_UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const MIN_BACKGROUND_UPDATE_CHECK_GAP_MS = 30 * 1000;

function BackgroundAppUpdateWatcher() {
  const { user } = useAuth();
  const updateFoundRef = useRef(false);
  const lastCheckAtRef = useRef(0);

  const checkInBackground = useCallback(() => {
    if (!user || updateFoundRef.current || document.visibilityState !== 'visible') return;

    const now = Date.now();
    if (now - lastCheckAtRef.current < MIN_BACKGROUND_UPDATE_CHECK_GAP_MS) return;
    lastCheckAtRef.current = now;

    void checkForAppUpdate().then(result => {
      // The waiting worker and AppUpdateModal handle the user-facing prompt.
      // Mark this session once an update is found so dismissing "Later" does
      // not keep reopening the prompt while the user is working.
      if (result.status === 'available') updateFoundRef.current = true;
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const initialCheck = window.setTimeout(checkInBackground, 20_000);
    const interval = window.setInterval(checkInBackground, BACKGROUND_UPDATE_CHECK_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkInBackground();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', checkInBackground);
    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', checkInBackground);
    };
  }, [checkInBackground, user]);

  return null;
}

function ResumeSyncIndicator() {
  const [syncing, setSyncing] = useState(false);
  const hiddenAtRef = useRef<number | null>(null);
  const syncPromiseRef = useRef<Promise<void> | null>(null);

  const syncLatestVersion = useCallback(() => {
    if (syncPromiseRef.current) return syncPromiseRef.current;

    setSyncing(true);
    const startedAt = Date.now();
    syncPromiseRef.current = checkForAppUpdate()
      .then(() => {
        const remaining = Math.max(0, 700 - (Date.now() - startedAt));
        return new Promise<void>(resolve => window.setTimeout(resolve, remaining));
      })
      .finally(() => {
        setSyncing(false);
        syncPromiseRef.current = null;
      });
    return syncPromiseRef.current;
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }

      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenAt && Date.now() - hiddenAt >= LONG_BACKGROUND_THRESHOLD_MS) {
        void syncLatestVersion();
      }
    };
    const handleOnline = () => void syncLatestVersion();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
    };
  }, [syncLatestVersion]);

  if (!syncing) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[120] flex justify-center px-4" role="status" aria-live="polite">
      <div className="flex h-10 items-center gap-2 rounded-full border border-white/[0.10] bg-[#101412]/95 px-4 text-[12px] font-semibold text-white/80 shadow-2xl backdrop-blur-xl">
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-400 motion-reduce:animate-none" />
        Syncing latest updates…
      </div>
    </div>
  );
}

export default function App() {
  const [showAppUpdate, setShowAppUpdate] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [targetVersion, setTargetVersion] = useState(APP_VERSION);
  const [targetBuildNumber, setTargetBuildNumber] = useState(APP_BUILD_NUMBER);
  const [targetReleaseHeadline, setTargetReleaseHeadline] = useState(APP_RELEASE_HEADLINE);
  const [targetReleaseHighlights, setTargetReleaseHighlights] = useState(APP_RELEASE_HIGHLIGHTS);
  const [updateRequired, setUpdateRequired] = useState(false);

  useEffect(() => {
    const handleUpdateAvailable = (event: Event) => {
      const update = (event as CustomEvent<PendingAppUpdate>).detail;
      setInstalledVersion(getInstalledAppVersion());
      setTargetVersion(update?.version || APP_VERSION);
      setTargetBuildNumber(update?.buildNumber || APP_BUILD_NUMBER);
      setTargetReleaseHeadline(update?.releaseHeadline || APP_RELEASE_HEADLINE);
      setTargetReleaseHighlights(update?.releaseHighlights || APP_RELEASE_HIGHLIGHTS);
      setUpdateRequired(Boolean(update?.required));
      setShowAppUpdate(true);
    };

    window.addEventListener(APP_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);

    setInstalledVersion(getInstalledAppVersion());
    const pendingUpdate = getPendingAppUpdate();
    if (hasPendingAppUpdate() && pendingUpdate) {
      setTargetVersion(pendingUpdate.version);
      setTargetBuildNumber(pendingUpdate.buildNumber);
      setTargetReleaseHeadline(pendingUpdate.releaseHeadline);
      setTargetReleaseHighlights(pendingUpdate.releaseHighlights);
      setUpdateRequired(pendingUpdate.required);
      setShowAppUpdate(true);
    }

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
          <StartupGate>
            <ServiceModeResumeRedirect />
            <LastRouteTracker />
            <ResumeSyncIndicator />
            <ToastProvider>
              <BackgroundAppUpdateWatcher />
              <DailyUpdateCheckExperience suppressed={showAppUpdate} />
              <ReleaseNotesExperience suppressed={showAppUpdate} />
              <AppUpdateModal
                open={showAppUpdate}
                currentVersion={installedVersion || APP_VERSION_LABEL}
                targetVersion={targetVersion}
                currentBuildNumber={APP_BUILD_NUMBER}
                targetBuildNumber={targetBuildNumber}
                headline={targetReleaseHeadline}
                highlights={targetReleaseHighlights}
                required={updateRequired}
                onLater={() => setShowAppUpdate(false)}
                onUpdate={() => {
                  setApplyingUpdate(true);
                  void applyPendingAppUpdate();
                }}
                applying={applyingUpdate}
              />
              <Routes>
              <Route path="/" element={<RootRedirect />} />
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
                    element={<RootRedirect />}
                  />
                  <Route path="/login" element={<LoginRoute />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/auth/confirm" element={<AuthConfirm />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/invite/:token" element={<InviteAccept />} />
                  <Route
                    path="/create-church"
                    element={<RootRedirect />}
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
                      <Route path="/settings/sounds" element={<SoundSettings />} />
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
                        element={<Navigate to="/admin/church" replace />}
                      />
                      <Route
                        path="/leadership/billing"
                        element={<OrganizationBilling />}
                      />
                      <Route
                        path="/leadership/notifications"
                        element={<Navigate to="/admin/notifications" replace />}
                      />
                      <Route path="/admin" element={<Navigate to="/admin/settings" replace />} />
                      <Route path="/admin/settings" element={<AdminSettings />} />
                      <Route path="/admin/church" element={<OrganizationSettings />} />
                      <Route path="/admin/notifications" element={<NotificationSettings />} />
                      <Route path="/admin/attendance-qr" element={<AttendanceQrPilot />} />
                      <Route path="/admin/reflections" element={<SurveyManagement />} />
                      <Route path="/admin/billing" element={<OrganizationBilling />} />
                      <Route
                        path="/leadership/surveys"
                        element={<Navigate to="/admin/reflections" replace />}
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
                  <Route path="*" element={<RootRedirect />} />
                </Route>
              </Route>
              </Routes>
            </ToastProvider>
          </StartupGate>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
