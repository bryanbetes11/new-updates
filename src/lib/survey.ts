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

  for (const row of data || []) {
    const campaign = (
      Array.isArray(row.survey_campaigns)
        ? row.survey_campaigns[0]
        : row.survey_campaigns
    ) as SurveyCampaign | null;
    if (
      !campaign ||
      !campaign.blocker_enabled ||
      campaign.status === "draft" ||
      campaign.status === "paused" ||
      campaign.status === "closed"
    )
      continue;
    if (campaign.starts_at && new Date(campaign.starts_at) > now) continue;
    const participation = row as unknown as SurveyParticipation;
    const temporaryAccessActive =
      participation.temporary_access_until &&
      new Date(participation.temporary_access_until) > now;
    if (!temporaryAccessActive) return { campaign, participation };
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
