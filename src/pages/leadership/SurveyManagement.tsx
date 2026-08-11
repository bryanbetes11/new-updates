import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BellRing,
  CalendarClock,
  Clock3,
  MessageCircle,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { supabase } from "../../lib/supabase";
import {
  formatSurveyTime,
  type SurveyCampaign,
  type SurveyParticipation,
} from "../../lib/survey";
import { PageLoader } from "../../components/LoadingSpinner";

type ProgressMember = SurveyParticipation & {
  name: string;
  email: string;
  assigned: number;
  completed: number;
  currentSection: string;
};

const accessDurations = [
  { label: "6 hours", hours: 6 },
  { label: "12 hours", hours: 12 },
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
];

export function SurveyManagement() {
  const {
    isProductionDirector,
    isMusicDirector,
    isStageDirector,
    isAdminCoordinator,
  } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<SurveyCampaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<ProgressMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const canManage = isProductionDirector;
  const canViewResults =
    canManage || isMusicDirector || isStageDirector || isAdminCoordinator;
  const [tab, setTab] = useState<"campaign" | "progress" | "results">(() =>
    canManage ? "campaign" : "results",
  );

  const selected =
    campaigns.find((campaign) => campaign.id === selectedId) ||
    campaigns[0] ||
    null;

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("survey_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast("error", error.message);
    else {
      const rows = (data || []) as SurveyCampaign[];
      setCampaigns(rows);
      setSelectedId((current) => current || rows[0]?.id || null);
    }
    setLoading(false);
  }, [toast]);

  const loadProgress = useCallback(async () => {
    if (!selected) return;
    const { data, error } = await supabase
      .from("survey_participations")
      .select(
        "*, profiles!survey_participations_user_id_fkey(first_name,last_name,nickname,email), survey_sections!survey_participations_last_section_id_fkey(title_en), survey_participant_sections(completed_at)",
      )
      .eq("campaign_id", selected.id)
      .order("last_saved_at", { ascending: false, nullsFirst: false });
    if (error) {
      toast("error", error.message);
      return;
    }
    setMembers(
      (data || []).map((row) => {
        const profile = Array.isArray(row.profiles)
          ? row.profiles[0]
          : row.profiles;
        const sections = row.survey_participant_sections || [];
        const currentSection = Array.isArray(row.survey_sections)
          ? row.survey_sections[0]?.title_en
          : row.survey_sections?.title_en;
        const fullName =
          `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();
        return {
          ...(row as SurveyParticipation),
          name: profile?.nickname || fullName || profile?.email || "Member",
          email: profile?.email || "",
          assigned: sections.length,
          completed: sections.filter(
            (section: { completed_at: string | null }) => section.completed_at,
          ).length,
          currentSection: currentSection || "Introduction",
        };
      }),
    );
  }, [selected, toast]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (tab === "progress") void loadProgress();
  }, [loadProgress, tab]);

  const createDraft = async () => {
    setWorking(true);
    const { data, error } = await supabase.rpc(
      "create_default_ministry_reflection",
    );
    if (error) toast("error", error.message);
    else {
      toast("success", "Draft reflection created.");
      await load();
      setSelectedId(data);
    }
    setWorking(false);
  };

  const publish = async () => {
    if (
      !selected ||
      !window.confirm(
        `Publish “${selected.title}” now? Active members will be assigned and notified.`,
      )
    )
      return;
    setWorking(true);
    const { error } = await supabase.rpc("publish_ministry_reflection", {
      p_campaign_id: selected.id,
      p_starts_at: new Date().toISOString(),
    });
    if (error) toast("error", error.message);
    else {
      toast("success", "Survey is live.");
      await load();
    }
    setWorking(false);
  };

  const schedule = async () => {
    if (!selected) return;
    const value = window.prompt(
      "Enter the launch date and time (example: 2026-08-15 19:30). Manila time will be used.",
    );
    if (!value) return;
    const launch = new Date(`${value.replace(" ", "T")}+08:00`);
    if (Number.isNaN(launch.getTime()) || launch <= new Date()) {
      toast("error", "Choose a valid future date and time.");
      return;
    }
    setWorking(true);
    const { error } = await supabase.rpc("publish_ministry_reflection", {
      p_campaign_id: selected.id,
      p_starts_at: launch.toISOString(),
    });
    if (error) toast("error", error.message);
    else {
      toast(
        "success",
        `Survey scheduled for ${formatSurveyTime(launch.toISOString())}.`,
      );
      await load();
    }
    setWorking(false);
  };

  const updateStatus = async (status: "paused" | "closed" | "live") => {
    if (!selected) return;
    const { error } = await supabase
      .from("survey_campaigns")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", selected.id);
    if (error) toast("error", error.message);
    else {
      toast("success", `Survey ${status}.`);
      await load();
    }
  };

  if (!canViewResults)
    return (
      <div className="page-container page-bottom-pad px-5 py-16 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-gray-400" />
        <h1 className="mt-4 text-xl font-black dark:text-white">
          Leadership access required
        </h1>
      </div>
    );
  if (loading) return <PageLoader />;

  return (
    <div className="page-container page-bottom-pad">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:py-9">
        <header className="overflow-hidden rounded-[2rem] border border-emerald-200/70 bg-emerald-50 p-6 dark:border-white/[0.08] dark:bg-[#07110d] sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
                Ministry care
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-gray-950 dark:text-white">
                Reflection campaigns.
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-gray-600 dark:text-white/50">
                Launch thoughtfully, follow progress without ranking people, and
                give temporary access when someone needs it.
              </p>
            </div>
            {canManage && (
              <button
                onClick={() => void createDraft()}
                disabled={working}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-950 px-5 py-3.5 text-sm font-black text-white dark:bg-emerald-400 dark:text-black"
              >
                <Plus className="h-4 w-4" /> New reflection
              </button>
            )}
          </div>
        </header>

        <div className="flex gap-2 rounded-2xl bg-gray-100 p-1 dark:bg-white/[0.05]">
          {[
            ...(canManage ? (["campaign", "progress"] as const) : []),
            "results" as const,
          ].map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-black capitalize ${tab === item ? "bg-white text-gray-950 shadow-sm dark:bg-white dark:text-black" : "text-gray-500 dark:text-white/45"}`}
            >
              {item}
            </button>
          ))}
        </div>

        {!selected ? (
          <div className="rounded-[1.75rem] border border-dashed border-gray-300 p-10 text-center dark:border-white/10">
            <p className="font-bold text-gray-500 dark:text-white/45">
              Create the first reflection campaign when you are ready.
            </p>
          </div>
        ) : tab === "campaign" ? (
          <section className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.07] dark:bg-white/[0.025] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${selected.status === "live" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300" : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/50"}`}
                >
                  {selected.status}
                </span>
                <h2 className="mt-3 text-2xl font-black text-gray-950 dark:text-white">
                  {selected.title}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-white/40">
                  Created {formatSurveyTime(selected.created_at)}
                </p>
              </div>
              <select
                value={selected.id}
                onChange={(event) => setSelectedId(event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold dark:border-white/10 dark:bg-[#111] dark:text-white"
              >
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.title} · {campaign.status}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Summary icon={Users} label="Audience" value="Active members" />
              <Summary
                icon={BellRing}
                label="Launch notice"
                value="In-app + Push"
              />
              <Summary
                icon={CalendarClock}
                label="Access rule"
                value={
                  selected.blocker_enabled
                    ? "Completion blocker"
                    : "Reminder only"
                }
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {selected.status === "draft" && (
                <>
                  <button
                    onClick={() => void publish()}
                    disabled={working}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-black"
                  >
                    <Play className="h-4 w-4" /> Publish survey
                  </button>
                  <button
                    onClick={() => void schedule()}
                    disabled={working}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-black dark:border-white/10 dark:text-white"
                  >
                    <CalendarClock className="h-4 w-4" /> Schedule launch
                  </button>
                </>
              )}
              {selected.status === "live" && (
                <button
                  onClick={() => void updateStatus("paused")}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-black dark:border-white/10 dark:text-white"
                >
                  <Pause className="h-4 w-4" /> Pause blocker
                </button>
              )}
              {selected.status === "paused" && (
                <button
                  onClick={() => void updateStatus("live")}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-black"
                >
                  <Play className="h-4 w-4" /> Resume
                </button>
              )}
              {!["draft", "closed"].includes(selected.status) && (
                <button
                  onClick={() => void updateStatus("closed")}
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-black text-gray-600 dark:border-white/10 dark:text-white/55"
                >
                  Close campaign
                </button>
              )}
            </div>
          </section>
        ) : tab === "progress" ? (
          <ProgressTable
            members={members}
            onRefresh={loadProgress}
            onGrant={async (member, hours, customUntil) => {
              const { error } = await supabase.rpc(
                "grant_survey_temporary_access",
                {
                  p_participation_id: member.id,
                  p_hours: hours,
                  p_custom_until: customUntil,
                },
              );
              if (error) toast("error", error.message);
              else {
                toast("success", `Temporary access granted to ${member.name}.`);
                await loadProgress();
              }
            }}
            onRemind={async (member) => {
              const { error } = await supabase.rpc("send_survey_reminder", {
                p_participation_id: member.id,
              });
              if (error) toast("error", error.message);
              else toast("success", `Reminder queued for ${member.name}.`);
            }}
          />
        ) : (
          <ResultsPanel campaignId={selected.id} canSeeCommitment={canManage} />
        )}
      </div>
    </div>
  );
}

type ResultRow = {
  answer: { value?: string } | string;
  survey_questions:
    | {
        prompt_en: string;
        answer_type: string;
        correct_option: string | null;
        clarification_area: string | null;
        survey_sections:
          | { campaign_id: string; title_en: string }
          | Array<{ campaign_id: string; title_en: string }>;
      }
    | Array<{
        prompt_en: string;
        answer_type: string;
        correct_option: string | null;
        clarification_area: string | null;
        survey_sections: { campaign_id: string; title_en: string };
      }>;
};

function ResultsPanel({
  campaignId,
  canSeeCommitment,
}: {
  campaignId: string;
  canSeeCommitment: boolean;
}) {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [commitments, setCommitments] = useState<
    Array<{ response_key: string; reflection: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    Promise.all([
      supabase
        .from("survey_responses")
        .select(
          "answer,survey_questions(prompt_en,answer_type,correct_option,clarification_area,survey_sections(campaign_id,title_en))",
        ),
      canSeeCommitment
        ? supabase
            .from("survey_commitment_responses")
            .select("response_key,reflection")
        : Promise.resolve({ data: [] }),
    ]).then(([responseResult, commitmentResult]) => {
      if (!active) return;
      setRows(
        ((responseResult.data || []) as unknown as ResultRow[]).filter(
          (row) => {
            const question = Array.isArray(row.survey_questions)
              ? row.survey_questions[0]
              : row.survey_questions;
            const section = Array.isArray(question?.survey_sections)
              ? question.survey_sections[0]
              : question?.survey_sections;
            return section?.campaign_id === campaignId;
          },
        ),
      );
      setCommitments(
        (commitmentResult.data || []) as Array<{
          response_key: string;
          reflection: string | null;
        }>,
      );
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [campaignId, canSeeCommitment]);
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        ratings: number[];
        suggestions: string[];
        clarifications: Map<string, number>;
      }
    >();
    rows.forEach((row) => {
      const question = Array.isArray(row.survey_questions)
        ? row.survey_questions[0]
        : row.survey_questions;
      const section = Array.isArray(question.survey_sections)
        ? question.survey_sections[0]
        : question.survey_sections;
      const entry = map.get(section.title_en) || {
        ratings: [],
        suggestions: [],
        clarifications: new Map<string, number>(),
      };
      const value =
        typeof row.answer === "string"
          ? row.answer
          : String(row.answer?.value || "");
      if (question.answer_type === "rating" && /^[1-5]$/.test(value))
        entry.ratings.push(Number(value));
      else if (question.answer_type === "long_text" && value.trim())
        entry.suggestions.push(value);
      else if (
        question.answer_type === "knowledge" &&
        question.correct_option &&
        value !== question.correct_option
      )
        entry.clarifications.set(
          question.clarification_area || question.prompt_en,
          (entry.clarifications.get(
            question.clarification_area || question.prompt_en,
          ) || 0) + 1,
        );
      map.set(section.title_en, entry);
    });
    return [...map.entries()];
  }, [rows]);
  if (loading) return <PageLoader />;
  return (
    <div className="space-y-4">
      {grouped.map(([title, result]) => (
        <section
          key={title}
          className="rounded-[1.75rem] border border-gray-200 bg-white p-5 dark:border-white/[0.07] dark:bg-white/[0.025]"
        >
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-emerald-500" />
            <h2 className="font-black text-gray-950 dark:text-white">
              {title}
            </h2>
          </div>
          {result.ratings.length > 0 && (
            <p className="mt-4 text-sm text-gray-500 dark:text-white/45">
              <span className="text-2xl font-black text-gray-950 dark:text-white">
                {(
                  result.ratings.reduce((a, b) => a + b, 0) /
                  result.ratings.length
                ).toFixed(1)}
              </span>{" "}
              average observation · {result.ratings.length} responses
            </p>
          )}
          {result.clarifications.size > 0 && (
            <div className="mt-5 rounded-2xl bg-amber-50 p-4 dark:bg-amber-300/[0.06]">
              <p className="text-xs font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Areas needing clarification
              </p>
              {[...result.clarifications.entries()].map(([area, count]) => (
                <p
                  key={area}
                  className="mt-2 text-sm text-amber-900 dark:text-amber-100"
                >
                  {area} · {count} response{count === 1 ? "" : "s"}
                </p>
              ))}
            </div>
          )}
          {result.suggestions.length > 0 && (
            <div className="mt-5">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-gray-400">
                <MessageCircle className="h-4 w-4" />
                Suggestions
              </p>
              <div className="mt-3 space-y-2">
                {result.suggestions.map((suggestion, index) => (
                  <blockquote
                    key={index}
                    className="rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-700 dark:bg-white/[0.04] dark:text-white/60"
                  >
                    {suggestion}
                  </blockquote>
                ))}
              </div>
            </div>
          )}
        </section>
      ))}
      {grouped.length === 0 && (
        <div className="rounded-[1.75rem] border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400 dark:border-white/10">
          Results will appear here after members submit.
        </div>
      )}
      {canSeeCommitment && commitments.length > 0 && (
        <section className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-400/10 dark:bg-emerald-400/[0.04]">
          <h2 className="font-black text-gray-950 dark:text-white">
            Commitment responses
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-white/40">
            Kept separate from knowledge-check performance.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {Object.entries(
              commitments.reduce<Record<string, number>>((acc, item) => {
                acc[item.response_key] = (acc[item.response_key] || 0) + 1;
                return acc;
              }, {}),
            ).map(([key, count]) => (
              <div
                key={key}
                className="rounded-xl bg-white p-3 dark:bg-white/[0.05]"
              >
                <p className="text-sm font-bold capitalize text-gray-700 dark:text-white/65">
                  {key.replace(/_/g, " ")}
                </p>
                <p className="mt-1 text-xl font-black text-gray-950 dark:text-white">
                  {count}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/[0.04]">
      <Icon className="h-5 w-5 text-emerald-500" />
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-white/30">
        {label}
      </p>
      <p className="mt-1 font-black text-gray-950 dark:text-white">{value}</p>
    </div>
  );
}

function ProgressTable({
  members,
  onRefresh,
  onGrant,
  onRemind,
}: {
  members: ProgressMember[];
  onRefresh: () => void;
  onGrant: (
    member: ProgressMember,
    hours: number,
    customUntil: string | null,
  ) => void;
  onRemind: (member: ProgressMember) => void;
}) {
  const submitted = members.filter(
    (member) => member.status === "submitted",
  ).length;
  const average = members.length
    ? Math.round(
        (members.reduce(
          (sum, member) =>
            sum + (member.assigned ? member.completed / member.assigned : 0),
          0,
        ) /
          members.length) *
          100,
      )
    : 0;
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-gray-200 bg-white shadow-sm dark:border-white/[0.07] dark:bg-white/[0.025]">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/[0.06]">
        <div>
          <h2 className="font-black text-gray-950 dark:text-white">
            Member progress
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-white/40">
            {submitted} submitted · {average}% average completion
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="rounded-xl border border-gray-200 p-2.5 text-gray-500 dark:border-white/10 dark:text-white/50"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-white/[0.05]">
        {members.map((member) => {
          const percent = member.assigned
            ? Math.round((member.completed / member.assigned) * 100)
            : 0;
          return (
            <div key={member.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-black text-gray-950 dark:text-white">
                      {member.name}
                    </p>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase text-gray-500 dark:bg-white/10 dark:text-white/45">
                      {member.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400 dark:text-white/30">
                    {member.currentSection} · Last saved{" "}
                    {formatSurveyTime(member.last_saved_at)}
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-black text-gray-600 dark:text-white/55">
                      {percent}%
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onRemind(member)}
                    title="Send reminder"
                    className="rounded-xl border border-gray-200 p-2.5 text-gray-500 dark:border-white/10 dark:text-white/50"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                  <select
                    defaultValue=""
                    onChange={(event) => {
                      const selectedValue = event.target.value;
                      if (selectedValue === "custom") {
                        const value = window.prompt(
                          "Enter the expiration date and time (example: 2026-08-15 21:30). Manila time will be used.",
                        );
                        if (value) {
                          const date = new Date(
                            `${value.replace(" ", "T")}+08:00`,
                          );
                          if (
                            !Number.isNaN(date.getTime()) &&
                            date > new Date()
                          )
                            onGrant(member, 0, date.toISOString());
                        }
                      } else if (selectedValue)
                        onGrant(member, Number(selectedValue), null);
                      event.target.value = "";
                    }}
                    className="rounded-xl border border-gray-200 bg-white px-2 text-xs font-bold text-gray-600 dark:border-white/10 dark:bg-[#111] dark:text-white/60"
                  >
                    <option value="">Temporary access</option>
                    {accessDurations.map((item) => (
                      <option key={item.hours} value={item.hours}>
                        {item.label}
                      </option>
                    ))}
                    <option value="custom">Custom expiration…</option>
                  </select>
                </div>
              </div>
              {member.temporary_access_until && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-300">
                  <Clock3 className="h-3.5 w-3.5" />
                  Access until {formatSurveyTime(member.temporary_access_until)}
                </p>
              )}
            </div>
          );
        })}
        {members.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-gray-400">
            No members have been assigned yet.
          </p>
        )}
      </div>
    </section>
  );
}
