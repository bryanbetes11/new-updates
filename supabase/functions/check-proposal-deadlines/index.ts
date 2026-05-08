import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, title, proposal_due_date, event_date, event_assignments(user_id, roles(name)), setlists(status)")
      .gte("event_date", now.toISOString())
      .not("proposal_due_date", "is", null);

    if (eventsError) {
      throw eventsError;
    }

    let notificationsSent = 0;
    const notifications = [];

    for (const event of events || []) {
      if (!event.proposal_due_date) continue;

      const dueDate = new Date(event.proposal_due_date);
      const hasApprovedSetlist = event.setlists?.some((s: any) => s.status === "approved");

      if (hasApprovedSetlist) continue;

      const timeUntilDue = dueDate.getTime() - now.getTime();
      const hoursUntilDue = timeUntilDue / (1000 * 60 * 60);

      const songLeaderAssignment = event.event_assignments?.find(
        (a: any) => a.roles?.name === "Song Leader"
      );

      if (!songLeaderAssignment) continue;

      let shouldNotify = false;
      let notificationBody = "";

      const eventDateStr = event.event_date
        ? new Date(event.event_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "";
      const titleWithDate = eventDateStr
        ? `"${event.title}" on ${eventDateStr}`
        : `"${event.title}"`;

      if (timeUntilDue < 0) {
        const hoursOverdue = Math.abs(hoursUntilDue);
        const daysOverdue = Math.floor(hoursOverdue / 24);

        if (daysOverdue === 0 && hoursOverdue <= 2) {
          shouldNotify = true;
          notificationBody = `The setlist proposal for ${titleWithDate} is now overdue. Please submit it as soon as possible.`;
        } else if (daysOverdue === 1) {
          shouldNotify = true;
          notificationBody = `The setlist proposal for ${titleWithDate} is 1 day overdue. Please submit it urgently.`;
        } else if (daysOverdue === 3 || daysOverdue === 7) {
          shouldNotify = true;
          notificationBody = `The setlist proposal for ${titleWithDate} is ${daysOverdue} days overdue. Please submit it immediately.`;
        }
      } else if (hoursUntilDue <= 72) {
        const daysUntilDue = Math.ceil(hoursUntilDue / 24);

        if (daysUntilDue === 3) {
          shouldNotify = true;
          notificationBody = `Reminder: The setlist proposal for ${titleWithDate} is due in 3 days.`;
        } else if (daysUntilDue === 1) {
          shouldNotify = true;
          notificationBody = `Urgent: The setlist proposal for ${titleWithDate} is due tomorrow.`;
        } else if (hoursUntilDue <= 6) {
          shouldNotify = true;
          notificationBody = `Final reminder: The setlist proposal for ${titleWithDate} is due in ${Math.ceil(hoursUntilDue)} hours.`;
        }
      }

      if (shouldNotify) {
        const existingNotification = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", songLeaderAssignment.user_id)
          .eq("type", "proposal_reminder")
          .eq("data->>event_id", event.id)
          .gte("created_at", new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (!existingNotification.data) {
          notifications.push({
            user_id: songLeaderAssignment.user_id,
            type: "proposal_reminder",
            title: "Setlist Proposal Reminder",
            body: notificationBody,
            data: {
              event_id: event.id,
              url: `/events/${event.id}`,
            },
          });
        }
      }
    }

    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (insertError) {
        console.error("Error inserting notifications:", insertError);
      } else {
        notificationsSent = notifications.length;
      }
    }

    return new Response(
      JSON.stringify({
        message: `Checked ${events?.length || 0} events, sent ${notificationsSent} reminders`,
        notificationsSent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
