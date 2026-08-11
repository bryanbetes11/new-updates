import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BellRing,
  BookOpen,
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  MessageCircle,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { supabase } from "../../lib/supabase";
import {
  formatSurveyTime,
  type SurveyCampaign,
  type SurveyParticipation,
  type SurveySection,
} from "../../lib/survey";
import { PageLoader } from "../../components/LoadingSpinner";
import { Modal } from "../../components/Modal";

type ProgressMember = SurveyParticipation & {
  name: string;
  email: string;
  assigned: number;
  completed: number;
  currentSection: string;
};

type TestMember = {
  id: string;
  name: string;
  email: string;
};

type TestAssignment = {
  id: string;
  user_id: string;
  status: SurveyParticipation["status"];
  name: string;
  email: string;
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
  const [contentOpen, setContentOpen] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [sections, setSections] = useState<SurveySection[]>([]);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editIntroductionEn, setEditIntroductionEn] = useState("");
  const [editIntroductionTl, setEditIntroductionTl] = useState("");
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testMembers, setTestMembers] = useState<TestMember[]>([]);
  const [testMemberId, setTestMemberId] = useState("");
  const [testAssignment, setTestAssignment] = useState<TestAssignment | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
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

  const loadTestAssignment = useCallback(async () => {
    if (!selected || selected.status !== "draft" || !canManage) {
      setTestAssignment(null);
      return;
    }
    const { data, error } = await supabase
      .from("survey_participations")
      .select("id,user_id,status,profiles!survey_participations_user_id_fkey(first_name,last_name,nickname,email)")
      .eq("campaign_id", selected.id)
      .eq("is_test", true)
      .maybeSingle();
    if (error) {
      toast("error", error.message);
      return;
    }
    if (!data) {
      setTestAssignment(null);
      return;
    }
    const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
    const fullName = `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();
    setTestAssignment({
      id: data.id,
      user_id: data.user_id,
      status: data.status as SurveyParticipation["status"],
      name: profile?.nickname || fullName || profile?.email || "Member",
      email: profile?.email || "",
    });
  }, [canManage, selected, toast]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (tab === "progress") void loadProgress();
  }, [loadProgress, tab]);
  useEffect(() => {
    void loadTestAssignment();
  }, [loadTestAssignment]);

  const openTestModal = async () => {
    if (!selected) return;
    setWorking(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id,first_name,last_name,nickname,email")
      .eq("org_id", selected.org_id)
      .eq("is_onboarded", true)
      .eq("ministry_status", "active")
      .order("first_name");
    setWorking(false);
    if (error) {
      toast("error", error.message);
      return;
    }
    const available = (data || []).map((profile) => {
      const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
      return {
        id: profile.id,
        name: profile.nickname || fullName || profile.email || "Member",
        email: profile.email || "",
      };
    });
    setTestMembers(available);
    setTestMemberId(testAssignment?.user_id || available[0]?.id || "");
    setTestModalOpen(true);
  };

  const startTest = async () => {
    if (!selected || !testMemberId) return;
    setWorking(true);
    const { error } = await supabase.rpc("start_ministry_reflection_test", {
      p_campaign_id: selected.id,
      p_user_id: testMemberId,
    });
    setWorking(false);
    if (error) {
      toast("error", error.message);
      return;
    }
    setTestModalOpen(false);
    toast("success", "Private test assigned. Only the selected member was notified.");
    await loadTestAssignment();
  };

  const endTest = async () => {
    if (!testAssignment) return;
    setWorking(true);
    const { error } = await supabase.rpc("end_ministry_reflection_test", {
      p_participation_id: testAssignment.id,
    });
    setWorking(false);
    if (error) {
      toast("error", error.message);
      return;
    }
    toast("success", "Test ended and its responses were removed.");
    await loadTestAssignment();
  };

  const createDraft = async () => {
    const existingDraft = campaigns.find((campaign) =>
      ["draft", "scheduled", "live", "paused"].includes(campaign.status),
    );
    if (existingDraft) {
      setSelectedId(existingDraft.id);
      setTab("campaign");
      toast("info", "Your existing reflection campaign is ready to review.");
      return;
    }
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

  const toggleContent = async () => {
    const nextOpen = !contentOpen;
    setContentOpen(nextOpen);
    if (!nextOpen || !selected || sections.length) return;
    setContentLoading(true);
    const { data, error } = await supabase
      .from("survey_sections")
      .select("*,survey_questions(*)")
      .eq("campaign_id", selected.id)
      .order("sort_order")
      .order("sort_order", { referencedTable: "survey_questions" });
    if (error) toast("error", error.message);
    else {
      setSections(
        ((data || []) as Array<SurveySection & { survey_questions?: SurveySection["questions"] }>).map((section) => ({
          ...section,
          questions: [...(section.survey_questions || [])].sort(
            (a, b) => a.sort_order - b.sort_order,
          ),
        })),
      );
    }
    setContentLoading(false);
  };

  useEffect(() => {
    setContentOpen(false);
    setSections([]);
    setEditing(false);
  }, [selected?.id]);

  const beginEditing = () => {
    if (!selected || selected.status !== "draft") return;
    setEditTitle(selected.title);
    setEditIntroductionEn(selected.introduction_en);
    setEditIntroductionTl(selected.introduction_tl);
    setEditing(true);
  };

  const saveContent = async () => {
    if (!selected || !editTitle.trim()) return;
    setWorking(true);
    const { error: campaignError } = await supabase
      .from("survey_campaigns")
      .update({
        title: editTitle.trim(),
        introduction_en: editIntroductionEn.trim(),
        introduction_tl: editIntroductionTl.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", selected.id)
      .eq("status", "draft");
    const questionResults = campaignError
      ? []
      : await Promise.all(
          sections.flatMap((section) =>
            (section.questions || []).map((question) =>
              supabase
                .from("survey_questions")
                .update({
                  prompt_en: question.prompt_en.trim(),
                  prompt_tl: question.prompt_tl.trim(),
                })
                .eq("id", question.id),
            ),
          ),
        );
    const questionError = questionResults.find((result) => result.error)?.error;
    if (campaignError || questionError) {
      toast("error", (campaignError || questionError)?.message || "Unable to save changes.");
    } else {
      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === selected.id
            ? {
                ...campaign,
                title: editTitle.trim(),
                introduction_en: editIntroductionEn.trim(),
                introduction_tl: editIntroductionTl.trim(),
              }
            : campaign,
        ),
      );
      setEditing(false);
      setPreviewRevision((revision) => revision + 1);
      toast("success", "Draft content updated.");
    }
    setWorking(false);
  };

  const deleteDraft = async () => {
    if (!selected || selected.status !== "draft") return;
    setWorking(true);
    const { error } = await supabase
      .from("survey_campaigns")
      .delete()
      .eq("id", selected.id)
      .eq("status", "draft");
    if (error) toast("error", error.message);
    else {
      toast("success", "Draft reflection deleted.");
      setDeleteConfirmationOpen(false);
      setSelectedId(null);
      await load();
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
            {selected.status === "draft" && (
              <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-400/15 dark:bg-violet-400/[0.055]">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                    <ClipboardCheck className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-gray-950 dark:text-white">Test with one member</p>
                    {testAssignment ? (
                      <p className="mt-1 text-sm text-gray-600 dark:text-white/55">
                        {testAssignment.name} · {testAssignment.status.replace(/_/g, " ")}. Test answers stay out of official results.
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-gray-600 dark:text-white/55">
                        Send the real draft experience to one person without notifying the rest of the team.
                      </p>
                    )}
                  </div>
                  {testAssignment ? (
                    <div className="flex gap-2">
                      <button onClick={() => void openTestModal()} disabled={working} className="rounded-xl border border-violet-300 px-3 py-2.5 text-xs font-black text-violet-700 dark:border-violet-300/20 dark:text-violet-200">
                        Reset test
                      </button>
                      <button onClick={() => void endTest()} disabled={working} className="rounded-xl border border-red-300 px-3 py-2.5 text-xs font-black text-red-600 dark:border-red-300/20 dark:text-red-300">
                        End test
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => void openTestModal()} disabled={working} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">
                      Choose tester
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="mt-6 border-t border-gray-200 pt-5 dark:border-white/[0.07]">
              <button
                onClick={() => void toggleContent()}
                className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-left dark:border-white/10 dark:bg-white/[0.035]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
                  <BookOpen className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-gray-950 dark:text-white">
                    Review survey content
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-white/45">
                    Introduction, bilingual sections, questions, and role scope
                  </span>
                </span>
                <ChevronDown
                  className={`h-5 w-5 text-gray-400 transition-transform ${contentOpen ? "rotate-180" : ""}`}
                />
              </button>
              {contentOpen && (
                <div className="mt-4 space-y-3">
                  {selected.status === "draft" && (
                    <div className="flex flex-wrap gap-2">
                      {!editing ? (
                        <button
                          onClick={beginEditing}
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black dark:border-white/10 dark:text-white"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit content
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => void saveContent()}
                            disabled={working || !editTitle.trim()}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-black disabled:opacity-50"
                          >
                            <Save className="h-3.5 w-3.5" /> Save changes
                          </button>
                          <button
                            onClick={() => setEditing(false)}
                            disabled={working}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black dark:border-white/10 dark:text-white"
                          >
                            <X className="h-3.5 w-3.5" /> Cancel
                          </button>
                        </>
                      )}
                      {!editing && (
                        <button
                          onClick={() => setDeleteConfirmationOpen(true)}
                          disabled={working}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-300 px-3 py-2 text-xs font-black text-red-600 dark:border-red-400/20 dark:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete draft
                        </button>
                      )}
                    </div>
                  )}
                  {editing && (
                    <label className="block rounded-2xl border border-emerald-400/30 p-4">
                      <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Campaign title</span>
                      <input
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-950 outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-black dark:text-white"
                      />
                    </label>
                  )}
                  <div className="rounded-2xl border border-gray-200 p-4 dark:border-white/10">
                    <p className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                      Introduction
                    </p>
                    {editing ? (
                      <>
                        <textarea value={editIntroductionEn} onChange={(event) => setEditIntroductionEn(event.target.value)} rows={8} className="mt-3 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm leading-6 text-gray-900 outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-black dark:text-white" />
                        <textarea value={editIntroductionTl} onChange={(event) => setEditIntroductionTl(event.target.value)} rows={8} className="mt-3 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm leading-6 text-gray-900 outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-black dark:text-white" />
                      </>
                    ) : (
                      <>
                        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-700 dark:text-white/70">{selected.introduction_en}</p>
                        <p className="mt-4 whitespace-pre-line border-t border-gray-200 pt-4 text-sm leading-6 text-gray-600 dark:border-white/10 dark:text-white/55">{selected.introduction_tl}</p>
                      </>
                    )}
                  </div>
                  {contentLoading ? (
                    <p className="py-6 text-center text-sm text-gray-500">Loading survey content…</p>
                  ) : (
                    sections.map((section) => (
                      <div key={section.id} className="rounded-2xl border border-gray-200 p-4 dark:border-white/10">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="font-black text-gray-950 dark:text-white">{section.title_en}</h3>
                            <p className="text-sm text-gray-500 dark:text-white/45">{section.title_tl}</p>
                          </div>
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-gray-600 dark:bg-white/10 dark:text-white/55">
                            {section.required_role ? `${section.required_role} only` : "All members"}
                          </span>
                        </div>
                        <div className="mt-4 space-y-3">
                          {(section.questions || []).map((question, index) => (
                            <div key={question.id} className="rounded-xl bg-gray-50 p-3 dark:bg-white/[0.035]">
                              <p className="text-xs font-black text-gray-400">QUESTION {index + 1}</p>
                              {editing ? (
                                <div className="mt-2 space-y-2">
                                  <textarea value={question.prompt_en} onChange={(event) => setSections((current) => current.map((item) => item.id === section.id ? { ...item, questions: (item.questions || []).map((candidate) => candidate.id === question.id ? { ...candidate, prompt_en: event.target.value } : candidate) } : item))} rows={2} className="w-full rounded-lg border border-gray-200 bg-white p-2 text-sm font-bold text-gray-900 outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-black dark:text-white" />
                                  <textarea value={question.prompt_tl} onChange={(event) => setSections((current) => current.map((item) => item.id === section.id ? { ...item, questions: (item.questions || []).map((candidate) => candidate.id === question.id ? { ...candidate, prompt_tl: event.target.value } : candidate) } : item))} rows={2} className="w-full rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-700 outline-none focus:border-emerald-400 dark:border-white/10 dark:bg-black dark:text-white/70" />
                                </div>
                              ) : (
                                <>
                                  <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white/85">{question.prompt_en}</p>
                                  <p className="mt-1 text-sm text-gray-500 dark:text-white/50">{question.prompt_tl}</p>
                                  {question.options?.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-200 pt-3 dark:border-white/10">
                                      {question.options.map((option) => (
                                        <span key={option.value} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-gray-600 ring-1 ring-gray-200 dark:bg-white/[0.04] dark:text-white/55 dark:ring-white/10">
                                          {option.label}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ))}
                          {section.section_type === "commitment" && (
                            <p className="rounded-xl bg-emerald-500/[0.07] p-3 text-sm text-emerald-700 dark:text-emerald-300">
                              Commitment choices are presented separately from feedback and knowledge-check answers.
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <LiveSurveyPreview campaignId={selected.id} revision={previewRevision} />
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
        <Modal
          open={testModalOpen}
          onClose={() => !working && setTestModalOpen(false)}
          title={testAssignment ? "Reset member test" : "Test with one member"}
          size="sm"
          mobileView="sheet"
          closeOnBackdrop={!working}
          closeOnEscape={!working}
        >
          <div className="space-y-5">
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-900 dark:border-violet-400/15 dark:bg-violet-400/[0.06] dark:text-violet-100/75">
              Only this member receives the test assignment and notification. Starting or resetting clears this member’s earlier test answers. Official campaign results are unaffected.
            </div>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-white/40">Test member</span>
              <select value={testMemberId} onChange={(event) => setTestMemberId(event.target.value)} disabled={Boolean(testAssignment)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold text-gray-950 dark:border-white/10 dark:bg-[#111] dark:text-white">
                {testMembers.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}{member.email ? ` · ${member.email}` : ""}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setTestModalOpen(false)} disabled={working} className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-black text-gray-700 dark:border-white/10 dark:text-white">Cancel</button>
              <button onClick={() => void startTest()} disabled={working || !testMemberId} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                {working ? "Preparing…" : testAssignment ? "Reset test" : "Send test"}
              </button>
            </div>
          </div>
        </Modal>
        <Modal
          open={deleteConfirmationOpen}
          onClose={() => !working && setDeleteConfirmationOpen(false)}
          title="Delete this draft?"
          size="sm"
          mobileView="sheet"
          closeOnBackdrop={!working}
          closeOnEscape={!working}
        >
          <div className="space-y-5">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-400/15 dark:bg-red-400/[0.06]">
              <p className="text-sm font-bold text-red-900 dark:text-red-100">{selected?.title}</p>
              <p className="mt-2 text-sm leading-6 text-red-700 dark:text-red-200/70">
                This permanently removes this draft, including all of its sections and questions. Published campaigns cannot be deleted here.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDeleteConfirmationOpen(false)} disabled={working} className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-black text-gray-700 dark:border-white/10 dark:text-white">
                Keep draft
              </button>
              <button onClick={() => void deleteDraft()} disabled={working} className="rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                {working ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}

type ResultRow = {
  answer: { value?: string } | string;
  survey_participations:
    | { is_test: boolean }
    | Array<{ is_test: boolean }>;
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

type PreviewDevice = "phone" | "tablet" | "desktop";

const previewDeviceWidths: Record<PreviewDevice, string> = {
  phone: "390px",
  tablet: "820px",
  desktop: "1180px",
};

function LiveSurveyPreview({ campaignId, revision }: { campaignId: string; revision: number }) {
  const [open, setOpen] = useState(true);
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [manualRevision, setManualRevision] = useState(0);
  const previewUrl = `/reflection?preview=intro&campaignId=${encodeURIComponent(campaignId)}&device=${device}&revision=${revision + manualRevision}`;

  return (
    <div className="mt-6 border-t border-gray-200 pt-5 dark:border-white/[0.07]">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-black/20">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 p-4 dark:border-white/10">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
            <Play className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-gray-950 dark:text-white">Live survey preview</p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-white/45">Uses this campaign’s real introduction, sections, questions, and role rules. Preview answers are never saved.</p>
          </div>
          <button onClick={() => setOpen((current) => !current)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
            {open ? "Hide preview" : "Show preview"}
          </button>
        </div>
        {open && (
          <div className="p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex rounded-xl border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-white/[0.035]">
                {(["phone", "tablet", "desktop"] as const).map((item) => (
                  <button key={item} onClick={() => setDevice(item)} aria-pressed={device === item} className={`rounded-lg px-3 py-2 text-xs font-black capitalize ${device === item ? "bg-gray-950 text-white dark:bg-white dark:text-black" : "text-gray-500 dark:text-white/45"}`}>
                    {item === "tablet" ? "iPad" : item}
                  </button>
                ))}
              </div>
              <button onClick={() => setManualRevision((current) => current + 1)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-600 dark:border-white/10 dark:bg-white/[0.035] dark:text-white/60">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
            <div className="overflow-x-auto rounded-2xl bg-[#050706] p-3">
              <div className="mx-auto overflow-hidden rounded-[1.5rem] border border-white/10 bg-black shadow-2xl" style={{ width: previewDeviceWidths[device], maxWidth: "100%" }}>
                <iframe key={`${campaignId}-${revision}-${manualRevision}-${device}`} title={`Live survey preview — ${device}`} src={previewUrl} className="block h-[780px] w-full bg-black" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
          "answer,survey_participations!inner(is_test),survey_questions(prompt_en,answer_type,correct_option,clarification_area,survey_sections(campaign_id,title_en))",
        ),
      canSeeCommitment
        ? supabase
            .from("survey_commitment_responses")
            .select("response_key,reflection,survey_participations!inner(is_test)")
        : Promise.resolve({ data: [] }),
    ]).then(([responseResult, commitmentResult]) => {
      if (!active) return;
      setRows(
        ((responseResult.data || []) as unknown as ResultRow[]).filter(
          (row) => {
            const participation = Array.isArray(row.survey_participations)
              ? row.survey_participations[0]
              : row.survey_participations;
            const question = Array.isArray(row.survey_questions)
              ? row.survey_questions[0]
              : row.survey_questions;
            const section = Array.isArray(question?.survey_sections)
              ? question.survey_sections[0]
              : question?.survey_sections;
            return !participation?.is_test && section?.campaign_id === campaignId;
          },
        ),
      );
      setCommitments(
        (commitmentResult.data || [])
          .filter((row) => {
            const participation = Array.isArray(row.survey_participations)
              ? row.survey_participations[0]
              : row.survey_participations;
            return !participation?.is_test;
          })
          .map((row) => ({ response_key: row.response_key, reflection: row.reflection })) as Array<{
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
