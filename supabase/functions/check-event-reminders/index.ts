import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Assignment {
  user_id: string;
  roles: { name: string } | null;
  profiles: { first_name: string; last_name: string; gender: string | null } | null;
}

interface Event {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
  start_time: string | null;
  song_leader_id: string | null;
  linked_event_id: string | null;
  event_assignments: Assignment[];
  song_leader_profile?: { first_name: string; last_name: string; gender: string | null } | null;
  linked_event?: { song_leader_id: string | null; song_leader_profile?: { first_name: string; last_name: string; gender: string | null } | null } | null;
}

function getNamePrefix(gender: string | null): string {
  if (gender === "Male") return "Bro. ";
  if (gender === "Female") return "Sis. ";
  return "";
}

function formatTime12Hour(time: string | null): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
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
    const reminderType = url.searchParams.get("type") || "day_before";

    const phNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const phToday = phNow.toISOString().split("T")[0];

    let targetDate: string;
    let notificationType: string;
    let notificationTitle: string;
    let bodyTemplate: "day_before" | "day_of";

    if (reminderType === "day_of") {
      targetDate = phToday;
      notificationType = "event_today_reminder";
      notificationTitle = "Reminder";
      bodyTemplate = "day_of";
    } else {
      const tomorrow = new Date(phNow);
      tomorrow.setDate(tomorrow.getDate() + 1);
      targetDate = tomorrow.toISOString().split("T")[0];
      notificationType = "event_reminder";
      notificationTitle = "Event Tomorrow";
      bodyTemplate = "day_before";
    }

    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select(`
        id, title, event_date, event_type, start_time, song_leader_id, linked_event_id,
        event_assignments(user_id, roles(name), profiles(first_name, last_name, gender)),
        song_leader_profile:profiles!events_song_leader_id_fkey(first_name, last_name, gender),
        linked_event:events!events_linked_event_id_fkey(
          song_leader_id,
          song_leader_profile:profiles!events_song_leader_id_fkey(first_name, last_name, gender)
        )
      `)
      .eq("event_date", targetDate);

    if (eventsError) {
      throw eventsError;
    }

    let notificationsSent = 0;
    const notifications: any[] = [];

    for (const event of (events || []) as Event[]) {
      let songLeaderName = "";

      if (event.song_leader_profile) {
        const prefix = getNamePrefix(event.song_leader_profile.gender);
        songLeaderName = `${prefix}${event.song_leader_profile.first_name} ${event.song_leader_profile.last_name}`;
      } else if (event.linked_event?.song_leader_profile) {
        const prefix = getNamePrefix(event.linked_event.song_leader_profile.gender);
        songLeaderName = `${prefix}${event.linked_event.song_leader_profile.first_name} ${event.linked_event.song_leader_profile.last_name}`;
      }

      const eventDateFormatted = formatDateLong(event.event_date);
      const eventTime = formatTime12Hour(event.start_time);

      const isRehearsalLinked = event.event_type === "Rehearsal" && event.linked_event_id;
      const eventDisplay = isRehearsalLinked ? "Sunday Service Rehearsal" : event.title;

      for (const assignment of event.event_assignments || []) {
        const roleName = assignment.roles?.name || "Team Member";

        let body = "";
        if (bodyTemplate === "day_before") {
          body = `You are scheduled tomorrow as ${roleName} for ${eventDisplay}`;
          if (songLeaderName) {
            body += `. Song Leader is ${songLeaderName}`;
          }
          body += ".";
        } else {
          body = `You have an event today as ${roleName} for ${eventDisplay}`;
          if (songLeaderName) {
            body += `. Song Leader is ${songLeaderName}`;
          }
          if (eventTime) {
            body += `. See you later at ${eventTime}`;
          }
          body += ". Remember to mark your attendance only when you are already at church.";
        }

        const existingCheck = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", assignment.user_id)
          .eq("type", notificationType)
          .eq("data->>event_id", event.id)
          .gte("created_at", new Date(phNow.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (!existingCheck.data) {
          notifications.push({
            user_id: assignment.user_id,
            type: notificationType,
            title: notificationTitle,
            body,
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
        message: `Checked ${events?.length || 0} events for ${targetDate}, sent ${notificationsSent} ${reminderType} reminders`,
        notificationsSent,
        targetDate,
        reminderType,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in check-event-reminders:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
