import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getActiveSurveyGate } from "../lib/survey";
import { PageLoader } from "./LoadingSpinner";

export function SurveyGate() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const [blocked, setBlocked] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    if (!user || !profile?.org_id || !profile.is_onboarded) {
      setBlocked(false);
      return () => {
        active = false;
      };
    }
    getActiveSurveyGate(user.id)
      .then((gate) => {
        if (active) setBlocked(Boolean(gate));
      })
      .catch((error) => {
        console.error("[Survey] Unable to check access gate:", error);
        if (active) setBlocked(false);
      });
    return () => {
      active = false;
    };
  }, [profile?.is_onboarded, profile?.org_id, user]);

  if (blocked === null) return <PageLoader />;
  if (blocked && location.pathname !== "/reflection") {
    return (
      <Navigate
        to="/reflection"
        replace
        state={{ returnTo: `${location.pathname}${location.search}` }}
      />
    );
  }
  return <Outlet />;
}
