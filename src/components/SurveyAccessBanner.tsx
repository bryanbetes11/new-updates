import { useEffect, useState } from "react";
import { ArrowRight, Clock3 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { formatSurveyTime, type SurveyParticipation } from "../lib/survey";

export function SurveyAccessBanner() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [participation, setParticipation] =
    useState<SurveyParticipation | null>(null);

  useEffect(() => {
    let active = true;
    if (!user || location.pathname === "/reflection") return;
    supabase
      .from("survey_participations")
      .select("*,survey_campaigns!inner(status,starts_at)")
      .eq("user_id", user.id)
      .is("submitted_at", null)
      .order("created_at", {
        ascending: false,
        referencedTable: "survey_campaigns",
      })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (
          active &&
          data?.temporary_access_until &&
          new Date(data.temporary_access_until) > new Date()
        )
          setParticipation(data as SurveyParticipation);
        else if (active) setParticipation(null);
      });
    return () => {
      active = false;
    };
  }, [location.pathname, user]);

  if (!participation) return null;
  return (
    <div className="mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-[1496px] items-center gap-3 rounded-2xl border border-amber-300/35 bg-amber-50 px-4 py-2.5 text-amber-950 shadow-sm sm:w-[calc(100%-3rem)] sm:px-5 md:w-[calc(100%-4rem)] dark:border-amber-300/15 dark:bg-amber-300/[0.07] dark:text-amber-100">
      <Clock3 className="h-4 w-4 shrink-0 text-amber-500" />
      <p className="min-w-0 flex-1 text-xs font-bold">
        Reflection in progress{" "}
        <span className="font-normal opacity-65">
          · Access ends {formatSurveyTime(participation.temporary_access_until)}
        </span>
      </p>
      <button
        onClick={() => navigate("/reflection")}
        className="inline-flex items-center gap-1 text-xs font-black text-amber-700 dark:text-amber-300"
      >
        Continue <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
