import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { supabase } from "../lib/supabase";
import {
  formatSurveyTime,
  getActiveSurveyGate,
  splitSurveyParagraphs,
  type SurveyCampaign,
  type SurveyParticipation,
  type SurveyQuestion,
  type SurveySection,
} from "../lib/survey";
import { PageLoader } from "../components/LoadingSpinner";

type Answers = Record<string, string>;

function renderSurveySurface(content: ReactNode) {
  return createPortal(content, document.body);
}

const commitmentOptions = [
  [
    "recommit",
    "I’m ready to recommit for this season",
    "Handa akong muling magtalaga sa panahong ito",
  ],
  [
    "adjustments",
    "I’d like to serve with some adjustments",
    "Nais kong maglingkod na may ilang pagbabago",
  ],
  [
    "reflect",
    "I need time to reflect and pray",
    "Kailangan ko pa ng panahon upang magnilay at manalangin",
  ],
  [
    "conversation",
    "I’d like a private conversation first",
    "Nais ko munang magkaroon ng pribadong pag-uusap",
  ],
] as const;

const ratingTagalog: Record<string, string> = {
  "Strongly disagree": "Lubos na hindi sumasang-ayon",
  Disagree: "Hindi sumasang-ayon",
  Unsure: "Hindi tiyak",
  Agree: "Sumasang-ayon",
  "Strongly agree": "Lubos na sumasang-ayon",
};

const optionTagalog: Record<string, string> = {
  "Popularity and crowd response": "Popularidad at tugon ng mga tao",
  "Gospel clarity, biblical truth, and the whole service": "Malinaw na Ebanghelyo, biblikal na katotohanan, at kabuuan ng service",
  "The Song Leader’s personal preference": "Personal na kagustuhan ng Song Leader",
  "Response → Call to Worship → Gospel Proclamation": "Pagtugon → Panawagan sa Pagsamba → Pagpapahayag ng Ebanghelyo",
  "Call to Worship → Gospel Proclamation → Response": "Panawagan sa Pagsamba → Pagpapahayag ng Ebanghelyo → Pagtugon",
  "Any order, as long as the songs are popular": "Anumang ayos, basta popular ang mga awit",
  "Does it mention Jesus, the cross, His death, or resurrection clearly?": "Malinaw ba nitong binabanggit si Jesus, ang krus, Kanyang kamatayan, o muling pagkabuhay?",
  "Is it currently popular?": "Popular ba ito ngayon?",
  "Is it easy for the band to play?": "Madali ba itong tugtugin ng banda?",
  "Whether the lyrics are grounded in Scripture rather than clichés or feelings alone": "Kung ang lyrics ay nakaugat sa Kasulatan sa halip na sa clichés o damdamin lamang",
  "Whether the recording has a strong build": "Kung malakas ang build ng recording",
  "Whether many churches use it": "Kung ginagamit ito ng maraming iglesia",
  "What Christ has finished for us": "Ang tinapos na ni Cristo para sa atin",
  "What we must achieve to earn God’s favor": "Ang kailangan nating makamit upang makuha ang pabor ng Diyos",
  "A stronger emotional atmosphere": "Mas matinding emosyonal na atmosphere",
  "God’s grace in Christ": "Ang biyaya ng Diyos kay Cristo",
  "Our praise controls God’s response or guarantees prosperity": "Kinokontrol ng ating papuri ang tugon ng Diyos o ginagarantiya ang kasaganaan",
  "Christ’s death and resurrection": "Ang kamatayan at muling pagkabuhay ni Cristo",
  "How the songs support the sermon and the whole Gospel flow of the service": "Kung paano sinusuportahan ng mga awit ang sermon at kabuuang daloy ng Ebanghelyo sa service",
  "Only the Song Leader’s preferred key": "Tanging gustong key ng Song Leader",
  "Only which songs receive the strongest crowd response": "Tanging mga awit na may pinakamalakas na tugon ng mga tao",
};

export function MinistryReflection() {
  const { user, signOut, isProductionDirector } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [campaign, setCampaign] = useState<SurveyCampaign | null>(null);
  const [participation, setParticipation] =
    useState<SurveyParticipation | null>(null);
  const [sections, setSections] = useState<SurveySection[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [commitment, setCommitment] = useState({
    response_key: "",
    reflection: "",
  });
  const [activeIndex, setActiveIndex] = useState(-3);
  const [holding, setHolding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const previewParams = new URLSearchParams(window.location.search);
  const previewCampaignId = previewParams.get("campaignId");
  const previewScreen = previewParams.get("preview");
  const previewDevice = previewParams.get("device");
  const isPreview = previewParams.has("preview") && (import.meta.env.DEV || isProductionDirector);

  useEffect(() => {
    if (!isPreview || previewDevice !== "phone") return;
    document.documentElement.dataset.surveyPreviewDevice = "phone";
    return () => {
      delete document.documentElement.dataset.surveyPreviewDevice;
    };
  }, [isPreview, previewDevice]);

  const loadSurvey = useCallback(async () => {
    if (isPreview) {
      let preview = createReflectionPreview();
      if (previewCampaignId) {
        const [{ data: campaignRow, error: campaignError }, { data: sectionRows, error: sectionError }] = await Promise.all([
          supabase.from("survey_campaigns").select("*").eq("id", previewCampaignId).single(),
          supabase.from("survey_sections").select("*,survey_questions(*)").eq("campaign_id", previewCampaignId).order("sort_order").order("sort_order", { referencedTable: "survey_questions" }),
        ]);
        if (campaignError || sectionError || !campaignRow) {
          toast("error", (campaignError || sectionError)?.message || "Unable to load this survey preview.");
          setLoading(false);
          return;
        }
        preview = {
          campaign: campaignRow as SurveyCampaign,
          participation: { ...preview.participation, campaign_id: previewCampaignId },
          sections: ((sectionRows || []) as Array<SurveySection & { survey_questions?: SurveyQuestion[] }>).map((section) => ({
            ...section,
            completed_at: null,
            questions: [...(section.survey_questions || [])].sort((a, b) => a.sort_order - b.sort_order),
          })),
        };
      }
      setCampaign(preview.campaign);
      setParticipation(preview.participation);
      setSections(preview.sections);
      setAnswers({});
      setActiveIndex(
        previewScreen === "overview"
          ? -2
          : previewScreen === "intro"
            ? -1
            : -3,
      );
      setLoading(false);
      return;
    }
    if (!user) return;
    setLoading(true);
    try {
      const gate = await getActiveSurveyGate(user.id);
      if (!gate) {
        navigate("/dashboard", { replace: true });
        return;
      }
      setCampaign(gate.campaign);
      setParticipation(gate.participation);
      const [
        { data: assigned, error: sectionError },
        { data: responseRows, error: responseError },
        { data: commitmentRow },
      ] = await Promise.all([
        supabase
          .from("survey_participant_sections")
          .select("completed_at, survey_sections(*, survey_questions(*))")
          .eq("participation_id", gate.participation.id),
        supabase
          .from("survey_responses")
          .select("question_id,answer")
          .eq("participation_id", gate.participation.id),
        supabase
          .from("survey_commitment_responses")
          .select("response_key,reflection")
          .eq("participation_id", gate.participation.id)
          .maybeSingle(),
      ]);
      if (sectionError) throw sectionError;
      if (responseError) throw responseError;
      const normalized = (assigned || [])
        .map((row) => {
          const raw = Array.isArray(row.survey_sections)
            ? row.survey_sections[0]
            : row.survey_sections;
          const section = raw as unknown as SurveySection;
          const nestedQuestions =
            (raw as unknown as { survey_questions?: SurveyQuestion[] })
              ?.survey_questions || [];
          return {
            ...section,
            completed_at: row.completed_at,
            questions: [...nestedQuestions].sort(
              (a, b) => a.sort_order - b.sort_order,
            ),
          } as SurveySection;
        })
        .sort((a, b) => a.sort_order - b.sort_order);
      setSections(normalized);
      setAnswers(
        Object.fromEntries(
          (responseRows || []).map((row) => [
            row.question_id,
            String(row.answer?.value ?? row.answer ?? ""),
          ]),
        ),
      );
      if (commitmentRow)
        setCommitment({
          response_key: commitmentRow.response_key,
          reflection: commitmentRow.reflection || "",
        });
      const resume = normalized.findIndex(
        (section) => section.id === gate.participation.last_section_id,
      );
      setActiveIndex(resume >= 0 ? resume : -3);
    } catch (error) {
      console.error(error);
      toast("error", "We could not load your reflection. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [isPreview, navigate, previewCampaignId, previewScreen, toast, user]);

  useEffect(() => {
    void loadSurvey();
  }, [loadSurvey]);

  const activeSection = activeIndex >= 0 ? sections[activeIndex] : null;
  const completedCount = sections.filter(
    (section) => section.completed_at,
  ).length;
  const sectionValid = useMemo(() => {
    if (!activeSection) return true;
    if (activeSection.section_type === "commitment")
      return Boolean(commitment.response_key);
    return (activeSection.questions || []).every(
      (question) => !question.required || Boolean(answers[question.id]?.trim()),
    );
  }, [activeSection, answers, commitment.response_key]);

  const saveCurrent = async (completeSection: boolean) => {
    if (!participation || !activeSection) return false;
    setSaving(true);
    if (isPreview) {
      if (completeSection) {
        setSections((current) => current.map((section) => section.id === activeSection.id ? { ...section, completed_at: new Date().toISOString() } : section));
      }
      setParticipation((current) => current ? { ...current, status: "in_progress", last_saved_at: new Date().toISOString(), last_section_id: activeSection.id } : current);
      setSaving(false);
      return true;
    }
    try {
      if (activeSection.section_type === "commitment") {
        if (commitment.response_key) {
          const { error } = await supabase
            .from("survey_commitment_responses")
            .upsert({
              participation_id: participation.id,
              ...commitment,
              saved_at: new Date().toISOString(),
            });
          if (error) throw error;
        }
      } else {
        const rows = (activeSection.questions || [])
          .filter((question) => answers[question.id] !== undefined)
          .map((question) => ({
            participation_id: participation.id,
            question_id: question.id,
            answer: { value: answers[question.id] },
            saved_at: new Date().toISOString(),
          }));
        if (rows.length) {
          const { error } = await supabase
            .from("survey_responses")
            .upsert(rows);
          if (error) throw error;
        }
      }
      if (completeSection) {
        const { error } = await supabase
          .from("survey_participant_sections")
          .update({ completed_at: new Date().toISOString() })
          .eq("participation_id", participation.id)
          .eq("section_id", activeSection.id);
        if (error) throw error;
      }
      const { error } = await supabase
        .from("survey_participations")
        .update({
          status: "in_progress",
          started_at: participation.started_at || new Date().toISOString(),
          last_saved_at: new Date().toISOString(),
          last_section_id: activeSection.id,
        })
        .eq("id", participation.id);
      if (error) throw error;
      setSections((current) =>
        current.map((section) =>
          section.id === activeSection.id && completeSection
            ? { ...section, completed_at: new Date().toISOString() }
            : section,
        ),
      );
      return true;
    } catch (error) {
      console.error(error);
      toast("error", "Your answers could not be saved. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const continueNext = async () => {
    if (!sectionValid) {
      toast("info", "Please answer each required item in this section.");
      return;
    }
    if (!(await saveCurrent(true))) return;
    if (activeIndex < sections.length - 1) setActiveIndex((index) => index + 1);
    else if (participation) {
      if (isPreview) {
        setSubmitted(true);
        return;
      }
      const { error } = await supabase.rpc("submit_ministry_reflection", {
        p_participation_id: participation.id,
      });
      if (error) toast("error", error.message);
      else setSubmitted(true);
    }
  };

  if (loading) return <PageLoader />;
  if (!campaign || !participation) return null;

  if (submitted) {
    return renderSurveySurface(
      <div className="survey-modal-surface min-h-[calc(100dvh-5rem)] bg-[#070908] px-5 py-12 text-white">
        <div className="mx-auto max-w-xl text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
          <h1 className="mt-6 text-3xl font-black tracking-tight">
            Thank you for answering honestly.
          </h1>
          <p className="mt-3 text-white/55">
            Salamat sa iyong tapat na pagsagot. Your reflection has been
            submitted and ServeSync is now available.
          </p>
          <button
            onClick={() => navigate("/dashboard", { replace: true })}
            className="mt-8 w-full rounded-2xl bg-emerald-500 px-5 py-4 font-black text-black"
          >
            Enter ServeSync
          </button>
        </div>
      </div>
    );
  }

  if (holding) {
    return renderSurveySurface(
      <div className="survey-modal-surface min-h-[calc(100dvh-5rem)] bg-[#070908] px-5 py-10 text-white">
        <div className="mx-auto max-w-xl">
          <div className="flex items-center gap-3">
            <img
              src="/servesync-logo-latest.png"
              className="h-9 w-9 object-contain"
            />
            <span className="text-xl font-black">ServeSync</span>
          </div>
          <div className="mt-14 rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-6">
            <Save className="h-9 w-9 text-emerald-400" />
            <h1 className="mt-5 text-3xl font-black tracking-tight">
              Your progress is safe.
            </h1>
            <p className="mt-3 leading-7 text-white/55">
              Continue when you are ready. Your answers remain private while
              they are still being written.
            </p>
            <button
              onClick={() => setHolding(false)}
              className="mt-8 w-full rounded-2xl bg-emerald-500 px-5 py-4 font-black text-black"
            >
              Continue reflection
            </button>
            <button
              onClick={async () => {
                  if (isPreview) {
                    toast("success", "Temporary access requested.");
                    setParticipation({ ...participation, status: "temporary_access_requested" });
                    return;
                  }
                  const { error } = await supabase.rpc(
                  "request_survey_temporary_access",
                  { p_participation_id: participation.id, p_reason: null },
                );
                if (error) toast("error", error.message);
                else {
                  toast("success", "Temporary access requested.");
                  setParticipation({
                    ...participation,
                    status: "temporary_access_requested",
                  });
                }
              }}
              disabled={participation.status === "temporary_access_requested"}
              className="mt-3 w-full rounded-2xl border border-white/10 px-5 py-4 font-bold text-white/70 disabled:opacity-50"
            >
              {participation.status === "temporary_access_requested"
                ? "Temporary access requested"
                : "Request temporary access"}
            </button>
            <button
              onClick={() => void signOut()}
              className="mt-5 w-full text-sm font-bold text-white/40"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeIndex === -3) {
    return renderSurveySurface(
      <div className="survey-modal-surface min-h-[calc(100dvh-5rem)] bg-[#070908] px-5 py-8 text-white">
        <div className="mx-auto flex max-w-4xl flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/servesync-logo-latest.png" alt="" className="h-9 w-9 object-contain" />
              <span className="text-xl font-black">ServeSync</span>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <Save className="h-3.5 w-3.5" /> Saved
            </span>
          </div>

          {participation.is_test && (
            <div className="mt-7 inline-flex rounded-full border border-violet-400/20 bg-violet-400/[0.08] px-3 py-1.5 text-xs font-black text-violet-200">
              Private test · Answers stay out of official results
            </div>
          )}

          <div className="mt-12 max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-400">{campaign.title}</p>
            <h1 className="mt-5 text-5xl font-black leading-[0.98] tracking-[-0.055em] sm:text-6xl">
              Remember.<br />Reset. Rebuild.<br />Recommit.
            </h1>
            <p className="mt-6 text-xl font-bold leading-8 text-white/72">
              A guided reflection for our Worship &amp; Production Ministry.
              <span className="mt-2 block text-base font-medium leading-7 text-white/42">Isang gabay na pagninilay para sa ating Worship &amp; Production Ministry.</span>
            </p>
          </div>

          <div className="mt-10 border-l-2 border-emerald-400/55 pl-5 text-[15px] leading-7 text-white/62">
            <p>Before we plan what comes next, we want to listen carefully and understand where our ministry is today.</p>
            <p className="mt-3 text-white/42">Bago natin planuhin ang susunod, nais muna nating makinig nang mabuti at maunawaan kung nasaan ang ating ministry ngayon.</p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              [ShieldCheck, "Honest reflection", "Tapat na pagninilay"],
              [CheckCircle2, "Growth, not ranking", "Pag-unlad, hindi pagraranggo"],
              [Clock3, "Save and continue", "I-save at ipagpatuloy"],
            ].map(([Icon, en, tl]) => {
              const LandingIcon = Icon as typeof ShieldCheck;
              return (
                <div key={String(en)} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <LandingIcon className="h-5 w-5 text-emerald-400" />
                  <p className="mt-4 text-sm font-black">{String(en)}</p>
                  <p className="mt-1 text-xs leading-5 text-white/38">{String(tl)}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-auto pt-10">
            <button
              onClick={() => setActiveIndex(-1)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-black"
            >
              Continue to introduction <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-4 text-center text-xs leading-5 text-white/32">
              You can save your progress and return when you are ready.<br />Maaari mong i-save ang iyong progress at bumalik kapag handa ka na.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (activeIndex === -1) {
    return renderSurveySurface(
      <div className="survey-modal-surface min-h-[calc(100dvh-5rem)] bg-[#070908] px-5 py-8 text-white">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/servesync-logo-latest.png"
                className="h-9 w-9 object-contain"
              />
              <span className="text-xl font-black">ServeSync</span>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <Save className="h-3.5 w-3.5" /> Saved
            </span>
          </div>
          {participation.is_test && (
            <div className="mt-8 rounded-2xl border border-violet-400/20 bg-violet-400/[0.08] p-4 text-sm leading-6 text-violet-100/75">
              <span className="font-black text-violet-200">Private test</span>
              <br />
              Please use the survey as a member normally would. Your answers are temporary and will not be included in official ministry results.
            </div>
          )}
          <p className="mt-12 text-xs font-black uppercase tracking-[0.22em] text-emerald-400">
            Remember · Reset · Rebuild · Recommit
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em]">A time to reflect together.</h1>
          <p className="mt-3 text-sm leading-6 text-white/45">
            English is shown first, followed by the Tagalog translation.
            <span className="mt-1 block text-white/35">Nauuna ang English at sinusundan ng salin sa Tagalog.</span>
          </p>
          <div className="mt-8 space-y-8 text-[15px] leading-7 text-white/62">
            <div className="space-y-5">
              {splitSurveyParagraphs(campaign.introduction_en).map((p, i) => <p key={`en-${i}`}>{p}</p>)}
            </div>
            <div className="space-y-5 border-t border-white/10 pt-7 text-white/48">
              {splitSurveyParagraphs(campaign.introduction_tl).map((p, i) => <p key={`tl-${i}`}>{p}</p>)}
            </div>
          </div>
          <button
            onClick={() => setActiveIndex(-2)}
            className="mt-10 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-black"
          >
            Begin reflection <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setHolding(true)}
            className="mt-3 w-full px-5 py-3 text-sm font-bold text-emerald-400"
          >
            Save & continue later
          </button>
          <button
            onClick={() => setActiveIndex(-3)}
            className="mt-1 w-full px-5 py-3 text-sm font-bold text-white/40"
          >
            Back to title page
          </button>
        </div>
      </div>
    );
  }

  if (activeIndex === -2) {
    const nextIndex = Math.max(
      0,
      sections.findIndex((section) => !section.completed_at),
    );
    return renderSurveySurface(
      <div className="survey-modal-surface min-h-[calc(100dvh-5rem)] bg-[#070908] px-5 py-8 text-white">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/servesync-logo-latest.png"
                className="h-9 w-9 object-contain"
              />
              <span className="text-xl font-black">ServeSync</span>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <Save className="h-3.5 w-3.5" /> Saved just now
            </span>
          </div>
          <div className="mt-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
              Your reflection
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.045em]">
              Move at a thoughtful pace.
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-5 text-white/45">
              Complete one chapter at a time. You can save your work and return
              without losing your place.
            </p>
          </div>
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            {sections.map((section, index) => (
              <button
                key={section.id}
                onClick={() => setActiveIndex(index)}
                className={`flex w-full items-center gap-3 border-b border-white/[0.07] px-4 py-3 text-left last:border-b-0 ${section.completed_at ? "bg-emerald-400/[0.045]" : index === nextIndex ? "bg-white/[0.035]" : "bg-transparent"}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${section.completed_at ? "bg-emerald-400 text-black" : index === nextIndex ? "border border-emerald-400 text-emerald-400" : "border border-white/15 text-white/30"}`}
                >
                  {section.completed_at ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-black">{section.title_en}</span>
                  <span className="mt-0.5 block text-xs text-white/35">
                    {section.required_role ? `${section.required_role}s only` : "All members"}
                  </span>
                </span>
                <span
                  className={`text-[10px] font-black uppercase tracking-wide ${section.completed_at ? "text-emerald-400" : index === nextIndex ? "text-white/60" : "text-white/25"}`}
                >
                  {section.completed_at
                    ? "Complete"
                    : index === nextIndex
                      ? "Continue"
                      : "Upcoming"}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setActiveIndex(nextIndex)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3.5 font-black text-black"
          >
            Continue with {sections[nextIndex]?.title_en}
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setHolding(true)}
            className="mt-3 w-full px-5 py-3 text-sm font-bold text-emerald-400"
          >
            Save & exit
          </button>
        </div>
      </div>
    );
  }

  return renderSurveySurface(
    <div className="survey-modal-surface min-h-[calc(100dvh-5rem)] bg-[#070908] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/servesync-logo-latest.png"
              className="h-8 w-8 object-contain"
            />
            <span className="font-black">ServeSync</span>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <Save className="h-3.5 w-3.5" /> Saved
          </span>
        </div>
        <div className="mt-7 flex gap-1.5" aria-label="Section progress">
          {sections.map((section, index) => (
            <span
              key={section.id}
              className={`h-1.5 flex-1 rounded-full ${section.completed_at || index === activeIndex ? "bg-emerald-400" : "bg-white/10"}`}
            />
          ))}
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-emerald-400">
          {activeSection?.title_en} <span className="text-white/20">·</span>{" "}
          Section {activeIndex + 1}
        </p>
        <motion.div
          key={activeSection?.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8"
        >
          <h1 className="text-3xl font-black tracking-[-0.04em]">
            {activeSection?.title_en}
          </h1>
          {activeSection?.description_en && (
            <p className="mt-5 text-sm leading-6 text-white/55">
              {activeSection.description_en}
              {activeSection.description_tl && <span className="mt-2 block text-white/40">{activeSection.description_tl}</span>}
            </p>
          )}
          {activeSection?.section_type === "feedback" && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.05] p-4 text-sm leading-6 text-white/55">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <p>
                Answer from your actual observations during this ministry season—not from expectations or assumptions.
                <span className="mt-1 block text-white/40">Sumagot batay sa iyong aktuwal na napansin sa panahong ito ng ministeryo—hindi batay sa inaasahan o palagay.</span>
              </p>
            </div>
          )}
          <div className="mt-7 space-y-9">
            {activeSection?.section_type === "commitment" ? (
              <CommitmentEditor value={commitment} onChange={setCommitment} />
            ) : (
              (activeSection?.questions || []).map((question) => (
                <QuestionEditor
                  key={question.id}
                  question={question}
                  value={answers[question.id] || ""}
                  onChange={(value) =>
                    setAnswers((current) => ({
                      ...current,
                      [question.id]: value,
                    }))
                  }
                />
              ))
            )}
          </div>
        </motion.div>
        <div className="mt-10 flex gap-3">
          <button
            onClick={() => setActiveIndex((index) => Math.max(-1, index - 1))}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 text-white/65"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => void continueNext()}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-black disabled:opacity-60"
          >
            {activeIndex === sections.length - 1
              ? "Submit reflection"
              : "Continue"}{" "}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={async () => {
            await saveCurrent(false);
            setHolding(true);
          }}
          className="mt-3 w-full px-5 py-3 text-sm font-bold text-emerald-400"
        >
          Save & continue later
        </button>
        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs leading-5 text-white/30">
          <LockKeyhole className="h-3.5 w-3.5" />
          Commitment responses stay separate from knowledge-check results.
        </p>
        {participation.temporary_access_until && (
          <p className="mt-2 flex items-center justify-center gap-2 text-xs text-amber-300">
            <Clock3 className="h-3.5 w-3.5" />
            Temporary access ends{" "}
            {formatSurveyTime(participation.temporary_access_until)}
          </p>
        )}
        <p className="sr-only">{completedCount} sections completed</p>
      </div>
    </div>
  );
}

function createReflectionPreview(): {
  campaign: SurveyCampaign;
  participation: SurveyParticipation;
  sections: SurveySection[];
} {
  const campaign: SurveyCampaign = {
    id: "preview-campaign",
    org_id: "preview-org",
    title: "2026 Ministry Reflection",
    status: "live",
    blocker_enabled: true,
    starts_at: new Date().toISOString(),
    deadline_at: null,
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    introduction_en:
      "This survey gives our ministry a clear and honest picture of how we are serving together today. Your responses will help leadership recognize our strengths, understand where communication or ministry processes are unclear, and decide what support or improvements the team needs.\n\nPlease answer honestly and thoughtfully. Base your answers on what you have personally observed and experienced—not only on what you hope to see or what you think the ideal answer should be.\n\nThere are no perfect responses. Constructive feedback, uncertainty, and different experiences are welcome.\n\nYour commitment response is not a test of faith or a way to earn God’s approval. Please choose the response that truthfully reflects where you are in this season.",
    introduction_tl:
      "Layunin ng survey na ito na magkaroon ang ating ministry ng malinaw at tapat na larawan kung paano tayo kasalukuyang naglilingkod nang sama-sama. Makakatulong ang iyong mga sagot upang makita ng leadership ang ating mga kalakasan, maunawaan kung saan hindi malinaw ang komunikasyon o mga proseso, at malaman kung anong suporta o pagbabago ang kailangan ng team.\n\nMangyaring sumagot nang tapat at may pag-iingat. Ibase ang iyong mga sagot sa personal mong napansin at naranasan—hindi lamang sa nais mong mangyari o sa palagay mong ideal na sagot.\n\nWalang perpektong sagot. Malugod naming tinatanggap ang makabuluhang puna, pag-aalinlangan, at magkakaibang karanasan.\n\nAng iyong sagot tungkol sa commitment ay hindi pagsusulit sa pananampalataya o paraan upang makamit ang pagsang-ayon ng Diyos. Piliin ang sagot na tapat na naglalarawan kung nasaan ka sa panahong ito.",
  };
  const titles = [
    [
      "production_director",
      "Production Director",
      "Production Director",
      "feedback",
    ],
    ["music_director", "Music Director", "Music Director", "feedback"],
    ["stage_director", "Stage Director", "Stage Director", "feedback"],
    ["admin_coordinator", "Admin Coordinator", "Admin Coordinator", "feedback"],
    [
      "setlist",
      "Setlist & Song Selection",
      "Setlist at Pagpili ng Awit",
      "knowledge",
    ],
    ["team_reflection", "Team Reflection", "Pagninilay ng Team", "reflection"],
    ["recommit", "Recommit", "Muling Pagtatalaga", "commitment"],
  ] as const;
  const sections: SurveySection[] = titles.map(
    ([key, en, tl, type], index) => ({
      id: `preview-${key}`,
      campaign_id: campaign.id,
      section_key: key,
      title_en: en,
      title_tl: tl,
      description_en:
        key === "setlist"
          ? "For Song Leaders only."
          : "Share what you have personally observed.",
      description_tl:
        key === "setlist"
          ? "Para lamang sa mga Song Leader."
          : "Ibahagi ang personal mong napansin.",
      section_type: type,
      required_role: key === "setlist" ? "Song Leader" : null,
      result_owner_role: null,
      sort_order: index * 10,
      completed_at: index < 2 ? new Date().toISOString() : null,
      questions:
        type === "commitment"
          ? []
          : [
              {
                id: `preview-q-${key}`,
                section_id: `preview-${key}`,
                question_key: `${key}_q`,
                prompt_en: `What could the ${en} improve or do differently?`,
                prompt_tl: `Ano ang maaaring pagbutihin o gawin nang naiiba ng ${tl}?`,
                helper_en: null,
                helper_tl: null,
                answer_type: "long_text",
                options: [],
                correct_option: null,
                clarification_area: null,
                required: true,
                sort_order: 10,
              },
            ],
    }),
  );
  return {
    campaign,
    participation: {
      id: "preview-participation",
      campaign_id: campaign.id,
      user_id: "preview-user",
      status: "in_progress",
      last_section_id: null,
      started_at: new Date().toISOString(),
      last_saved_at: new Date().toISOString(),
      submitted_at: null,
      temporary_access_requested_at: null,
      temporary_access_until: null,
      temporary_access_reason: null,
      is_test: false,
    },
    sections,
  };
}

function QuestionEditor({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  const visibleOptions = question.options.filter((option) => option.value !== "na");
  return (
    <fieldset className="border-b border-white/12 pb-9 last:border-b-0 last:pb-0">
      <legend className="text-lg font-black leading-7">
        {question.prompt_en}
        {question.prompt_tl && <span className="mt-2 block text-base font-semibold text-white/48">{question.prompt_tl}</span>}
      </legend>
      {question.answer_type === "long_text" ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={5}
          placeholder="Share what you have observed… / Ibahagi ang iyong napansin…"
          className="mt-4 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-4 text-white outline-none placeholder:text-white/25 focus:border-emerald-400/60"
        />
      ) : (
        <div className="mt-4 grid gap-2">
          {visibleOptions.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3.5 transition ${value === option.value ? "border-emerald-400 bg-emerald-400/[0.07]" : "border-white/10 bg-white/[0.025]"}`}
            >
              <input
                className="sr-only"
                type="radio"
                name={question.id}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
              />
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${value === option.value ? "border-emerald-400 bg-emerald-400 text-black" : "border-white/25"}`}
              >
                {value === option.value && <Check className="h-3 w-3" />}
              </span>
              <span>
                <span className="block text-sm font-bold">{option.label}</span>
                {(ratingTagalog[option.label] || optionTagalog[option.label]) && (
                  <span className="mt-1 block text-xs leading-5 text-white/42">{ratingTagalog[option.label] || optionTagalog[option.label]}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function CommitmentEditor({
  value,
  onChange,
}: {
  value: { response_key: string; reflection: string };
  onChange: (value: { response_key: string; reflection: string }) => void;
}) {
  return (
    <div>
      <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.05] p-4 text-sm leading-6 text-white/55">
        <p>This is not a test or a way to earn God’s approval. Choose the response that honestly reflects where you are today.</p>
        <p className="mt-2 text-white/40">Hindi ito pagsusulit o paraan upang makamit ang pagsang-ayon ng Diyos. Piliin ang tapat na naglalarawan kung nasaan ka ngayon.</p>
      </div>
      <div className="mt-5 grid gap-3">
        {commitmentOptions.map(([key, en, tl]) => (
          <label
            key={key}
            className={`flex cursor-pointer gap-3 rounded-2xl border p-4 ${value.response_key === key ? "border-emerald-400 bg-emerald-400/[0.06]" : "border-white/10 bg-white/[0.025]"}`}
          >
            <input
              type="radio"
              className="sr-only"
              checked={value.response_key === key}
              onChange={() => onChange({ ...value, response_key: key })}
            />
            <span
              className={`mt-1 h-5 w-5 shrink-0 rounded-full border-4 ${value.response_key === key ? "border-emerald-400 bg-emerald-400" : "border-white/25"}`}
            />
            <span>
              <span className="block font-black">{en}</span>
              <span className="mt-1 block text-sm text-white/45">{tl}</span>
            </span>
          </label>
        ))}
      </div>
      <label className="mt-7 block text-sm font-bold">
        Anything you’d like us to understand? <span className="font-normal text-white/35">(Optional)</span>
        <span className="mt-1 block font-normal text-white/45">May nais ka bang ipabatid sa amin? (Opsyonal)</span>
        <textarea
          value={value.reflection}
          maxLength={250}
          onChange={(event) =>
            onChange({ ...value, reflection: event.target.value })
          }
          rows={4}
          className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-4 text-white outline-none focus:border-emerald-400/60"
        />
      </label>
    </div>
  );
}
