import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CRON_SHARED_KEY = "leadership-member-actions-cron-2026-05-04";

interface AccountabilitySummary {
  user_id: string;
  proposal_overdue_count: number;
  proposal_submitted_late_count: number;
  pending_assignment_count: number;
  approved_leave_count: number;
  pending_leave_count: number;
  open_discipline_count: number;
  events_assigned: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  excused_count: number;
  offense_level: number;
}

function getManilaNow(baseNow = new Date()): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(baseNow)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+08:00`,
  );
}

function formatManilaYmd(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getQuarter(date: Date): number {
  return Math.ceil((date.getMonth() + 1) / 3);
}

function buildSummaryBody(
  churchName: string,
  actionableMembers: AccountabilitySummary[],
): string {
  const overdueProposals = actionableMembers.filter((member) => member.proposal_overdue_count > 0).length;
  const attendanceOffenses = actionableMembers.filter((member) => member.offense_level > 0).length;
  const openDiscipline = actionableMembers.filter((member) => member.open_discipline_count > 0).length;
  const pendingLeaves = actionableMembers.filter((member) => member.pending_leave_count > 0).length;

  const segments: string[] = [];
  if (overdueProposals > 0) segments.push(`${overdueProposals} overdue proposal${overdueProposals > 1 ? "s" : ""}`);
  if (attendanceOffenses > 0) segments.push(`${attendanceOffenses} attendance issue${attendanceOffenses > 1 ? "s" : ""}`);
  if (openDiscipline > 0) segments.push(`${openDiscipline} open discipline case${openDiscipline > 1 ? "s" : ""}`);
  if (pendingLeaves > 0) segments.push(`${pendingLeaves} pending leave approval${pendingLeaves > 1 ? "s" : ""}`);

  return `${actionableMembers.length} member${actionableMembers.length > 1 ? "s" : ""} in ${churchName} need follow-up today: ${segments.join(", ")}.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const debugNowParam = url.searchParams.get("debug_now");
    const cronKey = url.searchParams.get("cron_key");
    const authHeader = req.headers.get("Authorization") || "";
    const isServiceRoleRequest = authHeader === `Bearer ${supabaseKey}`;
    const isCronKeyRequest = cronKey === CRON_SHARED_KEY;

    if (!isServiceRoleRequest && !isCronKeyRequest) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsedDebugNow = debugNowParam ? new Date(debugNowParam) : null;
    const baseNow = parsedDebugNow && !Number.isNaN(parsedDebugNow.getTime()) ? parsedDebugNow : new Date();
    const manilaNow = getManilaNow(baseNow);
    const year = manilaNow.getFullYear();
    const quarter = getQuarter(manilaNow);
    const reminderKey = `leadership_actions_${formatManilaYmd(manilaNow)}`;

    const { data: organizations, error: orgsError } = await supabase
      .from("organizations")
      .select("id, name");

    if (orgsError) throw new Error(orgsError.message);

    const notifications: Array<Record<string, unknown>> = [];

    for (const org of organizations || []) {
      const { data: rollup, error: rollupError } = await supabase.rpc("get_org_member_accountability_rollup", {
        p_org_id: org.id,
        p_year: year,
        p_quarter: quarter,
      });

      if (rollupError) throw new Error(rollupError.message);

      const actionableMembers = ((rollup || []) as AccountabilitySummary[]).filter(
        (member) =>
          member.proposal_overdue_count > 0 ||
          member.offense_level > 0 ||
          member.open_discipline_count > 0 ||
          member.pending_leave_count > 0,
      );

      if (actionableMembers.length === 0) continue;

      const { data: orgAdmins, error: orgAdminsError } = await supabase
        .from("profiles")
        .select("id")
        .eq("org_id", org.id)
        .eq("is_org_admin", true);
      if (orgAdminsError) throw new Error(orgAdminsError.message);

      const { data: leadershipRoles, error: leadershipRolesError } = await supabase
        .from("user_roles")
        .select("user_id, roles!inner(is_leadership)")
        .eq("org_id", org.id)
        .eq("roles.is_leadership", true);
      if (leadershipRolesError) throw new Error(leadershipRolesError.message);

      const recipientIds = [
        ...new Set([
          ...(orgAdmins || []).map((row) => row.id),
          ...(leadershipRoles || []).map((row) => row.user_id),
        ]),
      ];

      const memberIds = actionableMembers.map((member) => member.user_id);
      const body = buildSummaryBody(org.name, actionableMembers);

      for (const recipientId of recipientIds) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", recipientId)
          .eq("type", "leadership_member_action_reminder")
          .eq("data->>reminder_key", reminderKey)
          .maybeSingle();

        if (existing) continue;

        notifications.push({
          user_id: recipientId,
          org_id: org.id,
          type: "leadership_member_action_reminder",
          title: "Members Need Follow-Up",
          body,
          data: {
            url: "/leadership/team",
            reminder_key: reminderKey,
            church_name: org.name,
            member_ids: memberIds,
            quarter,
            year,
          },
        });
      }
    }

    if (notifications.length > 0) {
      const { error: insertError } = await supabase.from("notifications").insert(notifications);
      if (insertError) throw new Error(insertError.message);
    }

    return new Response(
      JSON.stringify({
        message: `Sent ${notifications.length} leadership action reminders`,
        notificationsSent: notifications.length,
        manilaNow: manilaNow.toISOString(),
        reminderKey,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
