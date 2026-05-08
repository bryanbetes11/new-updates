import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CRON_SHARED_KEY = "proposal-reminders-cron-2026-05-04";

type ReminderSlot = "morning" | "midday" | "evening" | null;

interface EventAssignment {
  user_id: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
  roles: { name: string } | null;
}

interface SetlistRecord {
  status: string;
  submitted_at: string | null;
}

interface EventRecord {
  id: string;
  org_id: string;
  title: string;
  proposal_due_date: string | null;
  event_date: string;
  event_assignments: EventAssignment[];
  setlists: SetlistRecord[];
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

function getManilaHour(date: Date): number {
  return Number.parseInt(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date), 10);
}

function formatDateLong(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00+08:00`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatTime12Hour(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function addManilaDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfManilaDay(date: Date): Date {
  return new Date(`${formatManilaYmd(date)}T00:00:00+08:00`);
}

function dayDiffFromNow(now: Date, target: Date): number {
  return Math.round((startOfManilaDay(target).getTime() - startOfManilaDay(now).getTime()) / 86_400_000);
}

function getReminderSlot(now: Date): ReminderSlot {
  const hour = getManilaHour(now);
  if (hour === 9) return "morning";
  if (hour === 13) return "midday";
  if (hour === 19) return "evening";
  return null;
}

function hasSubmittedProposal(setlists: SetlistRecord[] | null | undefined): boolean {
  return (setlists || []).some((setlist) =>
    Boolean(setlist.submitted_at) ||
    ["pending_review", "approved", "revision_requested", "rejected"].includes(setlist.status)
  );
}

function getReminderDefinition(now: Date, dueDate: Date, slot: ReminderSlot): {
  key: string;
  title: string;
  bodyPrefix: string;
} | null {
  if (!slot) return null;

  const daysUntilDue = dayDiffFromNow(now, dueDate);
  const isOverdue = now.getTime() > dueDate.getTime();

  if (isOverdue) {
    if (slot === "midday") return null;
    return {
      key: `overdue_${formatManilaYmd(now)}_${slot}`,
      title: slot === "morning" ? "Overdue Setlist Proposal" : "Overdue Setlist Proposal Reminder",
      bodyPrefix:
        slot === "morning"
          ? "The setlist proposal is overdue."
          : "This is your second overdue reminder today.",
    };
  }

  if (daysUntilDue === 7 && slot === "morning") {
    return {
      key: "due_7_days",
      title: "Setlist Proposal Due in 1 Week",
      bodyPrefix: "The setlist proposal is due in 1 week.",
    };
  }

  if (daysUntilDue === 3 && slot === "morning") {
    return {
      key: "due_3_days",
      title: "Setlist Proposal Due in 3 Days",
      bodyPrefix: "The setlist proposal is due in 3 days.",
    };
  }

  if (daysUntilDue === 1) {
    return {
      key: `due_1_day_${slot}`,
      title:
        slot === "morning"
          ? "Setlist Proposal Due Tomorrow"
          : slot === "midday"
          ? "Setlist Proposal Due Tomorrow"
          : "Final Reminder Before Overdue",
      bodyPrefix:
        slot === "morning"
          ? "The setlist proposal will be overdue tomorrow."
          : slot === "midday"
          ? "This is another reminder that the setlist proposal will be overdue tomorrow."
          : "Final reminder before the setlist proposal becomes overdue tomorrow.",
    };
  }

  return null;
}

function buildReminderBody(prefix: string, eventTitle: string, eventDate: string): string {
  return `${prefix} Submit the proposal for "${eventTitle}" on ${eventDate} before 11:59 PM.`;
}

function buildSongLeaderName(assignment: EventAssignment | undefined): string {
  const first = assignment?.profiles?.first_name?.trim() || "";
  const last = assignment?.profiles?.last_name?.trim() || "";
  return `${first} ${last}`.trim() || "A Song Leader";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const debugNowParam = url.searchParams.get("debug_now");
    const debugEventId = url.searchParams.get("event_id");
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
    const baseNow = parsedDebugNow && !Number.isNaN(parsedDebugNow.getTime())
      ? parsedDebugNow
      : new Date();
    const phNow = getManilaNow(baseNow);
    const slot = getReminderSlot(phNow);

    if (!slot) {
      return new Response(
        JSON.stringify({
          message: "No proposal reminder slot at this time",
          notificationsSent: 0,
          manilaNow: phNow.toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let eventsQuery = supabase
      .from("events")
      .select("id, org_id, title, proposal_due_date, event_date, event_assignments(user_id, profiles(first_name, last_name), roles(name)), setlists(status, submitted_at)")
      .not("proposal_due_date", "is", null);

    if (debugEventId) {
      eventsQuery = eventsQuery.eq("id", debugEventId);
    }

    const { data: events, error: eventsError } = await eventsQuery;
    if (eventsError) throw new Error(eventsError.message);

    const notifications: Array<Record<string, unknown>> = [];

    for (const event of (events || []) as EventRecord[]) {
      if (!event.proposal_due_date) continue;
      if (hasSubmittedProposal(event.setlists)) continue;

      const dueDate = new Date(event.proposal_due_date);
      const reminderDefinition = getReminderDefinition(phNow, dueDate, slot);
      if (!reminderDefinition) continue;

      const songLeaderAssignment = event.event_assignments?.find(
        (assignment) => assignment.roles?.name === "Song Leader",
      );
      if (!songLeaderAssignment) continue;

      const shouldAlertLeadership =
        reminderDefinition.key.startsWith("overdue_") && slot === "morning";

      const existingNotification = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", songLeaderAssignment.user_id)
        .eq("type", "proposal_reminder")
        .eq("data->>event_id", event.id)
        .eq("data->>reminder_key", reminderDefinition.key)
        .maybeSingle();

      if (existingNotification.data) continue;

      notifications.push({
        user_id: songLeaderAssignment.user_id,
        type: "proposal_reminder",
        title: reminderDefinition.title,
        body: buildReminderBody(
          reminderDefinition.bodyPrefix,
          event.title,
          formatDateLong(event.event_date),
        ),
        data: {
          event_id: event.id,
          url: `/events/${event.id}`,
          reminder_key: reminderDefinition.key,
          slot,
        },
      });

      if (shouldAlertLeadership) {
        const { data: orgAdmins, error: orgAdminsError } = await supabase
          .from("profiles")
          .select("id")
          .eq("org_id", event.org_id)
          .eq("is_org_admin", true);

        if (orgAdminsError) {
          throw new Error(orgAdminsError.message);
        }

        const { data: leadershipRoles, error: leadershipRolesError } = await supabase
          .from("user_roles")
          .select("user_id, roles!inner(is_leadership)")
          .eq("org_id", event.org_id)
          .eq("roles.is_leadership", true);

        if (leadershipRolesError) {
          throw new Error(leadershipRolesError.message);
        }

        const recipientIds = [
          ...new Set([
            ...(orgAdmins || []).map((recipient) => recipient.id),
            ...(leadershipRoles || []).map((recipient) => recipient.user_id),
          ]),
        ];
        const songLeaderName = buildSongLeaderName(songLeaderAssignment);
        const leadershipKey = `proposal_overdue_alert_${event.id}_${songLeaderAssignment.user_id}`;

        for (const recipientId of recipientIds) {
          const leadershipExisting = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", recipientId)
            .eq("type", "proposal_overdue_alert")
            .eq("data->>event_id", event.id)
            .eq("data->>reminder_key", leadershipKey)
            .maybeSingle();

          if (leadershipExisting.data) continue;

          notifications.push({
            user_id: recipientId,
            org_id: event.org_id,
            type: "proposal_overdue_alert",
            title: "Overdue Setlist Proposal",
            body: `${songLeaderName} still has not submitted the setlist proposal for "${event.title}". Please follow up with them.`,
            data: {
              event_id: event.id,
              url: `/leadership/setlist-deadlines`,
              reminder_key: leadershipKey,
              song_leader_id: songLeaderAssignment.user_id,
            },
          });
        }
      }
    }

    let notificationsSent = 0;
    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (insertError) {
        throw new Error(insertError.message);
      }

      notificationsSent = notifications.length;
    }

    return new Response(
      JSON.stringify({
        message: `Sent ${notificationsSent} proposal reminders`,
        notificationsSent,
        slot,
        manilaNow: phNow.toISOString(),
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
