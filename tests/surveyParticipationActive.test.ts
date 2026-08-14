import {
  isSurveyParticipationActive,
  type SurveyCampaign,
  type SurveyParticipation,
} from "../src/lib/survey";

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, received ${actual}`);
}

const now = new Date("2026-08-14T06:00:00.000Z");
const campaign: SurveyCampaign = {
  id: "campaign",
  org_id: "org",
  title: "Reflection",
  status: "live",
  blocker_enabled: true,
  starts_at: "2026-08-14T05:00:00.000Z",
  deadline_at: null,
  introduction_en: "",
  introduction_tl: "",
  published_at: now.toISOString(),
  created_at: now.toISOString(),
};
const participation: SurveyParticipation = {
  id: "participation",
  campaign_id: campaign.id,
  user_id: "user",
  status: "temporary_access_active",
  last_section_id: null,
  started_at: null,
  last_saved_at: null,
  submitted_at: null,
  temporary_access_requested_at: null,
  temporary_access_until: "2026-08-19T02:40:31.000Z",
  temporary_access_reason: null,
  is_test: false,
};

expectEqual(isSurveyParticipationActive(campaign, participation, now), true, "live campaign");
expectEqual(isSurveyParticipationActive({ ...campaign, status: "closed" }, participation, now), false, "closed campaign");
expectEqual(isSurveyParticipationActive({ ...campaign, status: "paused" }, participation, now), false, "paused campaign");
expectEqual(isSurveyParticipationActive({ ...campaign, status: "scheduled", starts_at: "2026-08-15T00:00:00.000Z" }, participation, now), false, "future campaign");
expectEqual(isSurveyParticipationActive({ ...campaign, status: "draft" }, participation, now), false, "ordinary draft participation");
expectEqual(isSurveyParticipationActive({ ...campaign, status: "draft" }, { ...participation, is_test: true }, now), true, "private draft test");
expectEqual(isSurveyParticipationActive({ ...campaign, blocker_enabled: false }, participation, now), false, "non-blocking campaign");
