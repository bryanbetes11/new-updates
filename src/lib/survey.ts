import { supabase } from "./supabase";

export type SurveyCampaign = {
  id: string;
  org_id: string;
  title: string;
  status: "draft" | "scheduled" | "live" | "paused" | "closed";
  blocker_enabled: boolean;
  starts_at: string | null;
  deadline_at: string | null;
  introduction_en: string;
  introduction_tl: string;
  published_at: string | null;
  created_at: string;
};

export type SurveyParticipation = {
  id: string;
  campaign_id: string;
  user_id: string;
  status:
    | "not_started"
    | "in_progress"
    | "temporary_access_requested"
    | "temporary_access_active"
    | "access_expired"
    | "submitted";
  last_section_id: string | null;
  started_at: string | null;
  last_saved_at: string | null;
  submitted_at: string | null;
  temporary_access_requested_at: string | null;
  temporary_access_until: string | null;
  temporary_access_reason: string | null;
  is_test: boolean;
};

export type SurveyQuestion = {
  id: string;
  section_id: string;
  question_key: string;
  prompt_en: string;
  prompt_tl: string;
  helper_en: string | null;
  helper_tl: string | null;
  answer_type: "rating" | "long_text" | "single_choice" | "knowledge";
  options: Array<{ value: string; label: string }>;
  correct_option: string | null;
  clarification_area: string | null;
  required: boolean;
  sort_order: number;
};

export type SurveySection = {
  id: string;
  campaign_id: string;
  section_key: string;
  title_en: string;
  title_tl: string;
  description_en: string;
  description_tl: string;
  section_type: "feedback" | "knowledge" | "reflection" | "commitment";
  required_role: string | null;
  result_owner_role: string | null;
  sort_order: number;
  completed_at?: string | null;
  questions?: SurveyQuestion[];
};

export type SurveyGateState = {
  campaign: SurveyCampaign;
  participation: SurveyParticipation;
};

type SurveyParticipationRow = SurveyParticipation & {
  survey_campaigns?: SurveyCampaign | SurveyCampaign[] | null;
};

function getParticipationCampaign(row: SurveyParticipationRow) {
  return (Array.isArray(row.survey_campaigns)
    ? row.survey_campaigns[0]
    : row.survey_campaigns) || null;
}

export function isSurveyParticipationActive(
  campaign: SurveyCampaign,
  participation: SurveyParticipation,
  now = new Date(),
) {
  if (!campaign.blocker_enabled) return false;
  if (campaign.status === "paused" || campaign.status === "closed") return false;
  if (campaign.status === "draft" && !participation.is_test) return false;
  if (campaign.starts_at && new Date(campaign.starts_at) > now) return false;
  return true;
}

export function parseSurveyRating(value: string): number | null {
  return /^(?:[1-5]|3\.5)$/.test(value) ? Number(value) : null;
}

export async function getActiveSurveyGate(
  userId: string,
): Promise<SurveyGateState | null> {
  const now = new Date();
  const { data, error } = await supabase
    .from("survey_participations")
    .select("*, survey_campaigns(*)")
    .eq("user_id", userId)
    .is("submitted_at", null)
    .order("created_at", {
      referencedTable: "survey_campaigns",
      ascending: false,
    })
    .limit(5);
  if (error) throw error;

  for (const rawRow of data || []) {
    const row = rawRow as unknown as SurveyParticipationRow;
    const campaign = getParticipationCampaign(row);
    const participation = row as SurveyParticipation;
    if (!campaign || !isSurveyParticipationActive(campaign, participation, now)) continue;
    const temporaryAccessActive =
      participation.temporary_access_until &&
      new Date(participation.temporary_access_until) > now;
    if (!temporaryAccessActive) return { campaign, participation };
  }
  return null;
}

export async function getActiveTemporarySurveyAccess(
  userId: string,
): Promise<SurveyParticipation | null> {
  const now = new Date();
  const { data, error } = await supabase
    .from("survey_participations")
    .select("*, survey_campaigns(*)")
    .eq("user_id", userId)
    .is("submitted_at", null)
    .order("created_at", {
      referencedTable: "survey_campaigns",
      ascending: false,
    })
    .limit(5);
  if (error) throw error;

  for (const rawRow of data || []) {
    const row = rawRow as unknown as SurveyParticipationRow;
    const campaign = getParticipationCampaign(row);
    const participation = row as SurveyParticipation;
    if (!campaign || !isSurveyParticipationActive(campaign, participation, now)) continue;
    if (
      participation.temporary_access_until &&
      new Date(participation.temporary_access_until) > now
    ) return participation;
  }
  return null;
}

export function formatSurveyTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function splitSurveyParagraphs(value: string) {
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\n/g, " ").trim())
    .filter(Boolean);
}
