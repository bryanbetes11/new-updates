import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Assignment {
  user_id: string;
  profiles: { first_name: string; last_name: string } | null;
}

interface Event {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
  linked_event_id: string | null;
  event_assignments: Assignment[];
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
    const action = url.searchParams.get("action") || "remind";

    const phNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const phToday = phNow.toISOString().split("T")[0];

    let result: any = {};

    if (action === "notify_open") {
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select(`
          id, title, event_date, event_type, linked_event_id,
          event_assignments(user_id, profiles(first_name, last_name))
        `)
        .eq("event_date", phToday);

      if (eventsError) throw eventsError;

      let notificationsSent = 0;
      const notifications: any[] = [];

      for (const event of (events || []) as Event[]) {
        const isRehearsalLinked = event.event_type === "Rehearsal" && event.linked_event_id;
        const eventDisplay = isRehearsalLinked ? "Sunday Service Rehearsal" : event.title;

        for (const assignment of event.event_assignments || []) {
          const existing = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", assignment.user_id)
            .eq("type", "attendance_open")
            .eq("data->>event_id", event.id)
            .maybeSingle();

          if (!existing.data) {
            notifications.push({
              user_id: assignment.user_id,
              type: "attendance_open",
              title: "Attendance is Now Open",
              body: `Attendance for ${eventDisplay} is now open. Please mark your attendance only when you are already at church.`,
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
          console.error("Error inserting attendance-open notifications:", insertError);
        } else {
          notificationsSent = notifications.length;
        }
      }

      result = {
        action: "notify_open",
        targetDate: phToday,
        eventsChecked: events?.length || 0,
        notificationsSent,
      };
    } else if (action === "remind") {
      const yesterday = new Date(phNow);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select(`
          id, title, event_date, event_type, linked_event_id,
          event_assignments(user_id, profiles(first_name, last_name))
        `)
        .eq("event_date", yesterdayStr);

      if (eventsError) throw eventsError;

      let remindersSent = 0;
      const notifications: any[] = [];

      for (const event of (events || []) as Event[]) {
        const isRehearsalLinked = event.event_type === "Rehearsal" && event.linked_event_id;
        const eventDisplay = isRehearsalLinked ? "Sunday Service Rehearsal" : event.title;
        const eventDateFormatted = formatDateLong(event.event_date);

        for (const assignment of event.event_assignments || []) {
          const { data: existingAttendance } = await supabase
            .from("event_attendance")
            .select("id")
            .eq("event_id", event.id)
            .eq("user_id", assignment.user_id)
            .maybeSingle();

          if (existingAttendance) continue;

          const existingReminder = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", assignment.user_id)
            .eq("type", "attendance_reminder")
            .eq("data->>event_id", event.id)
            .maybeSingle();

          if (!existingReminder.data) {
            notifications.push({
              user_id: assignment.user_id,
              type: "attendance_reminder",
              title: "Attendance Reminder",
              body: `You haven't submitted your attendance for ${eventDisplay} on ${eventDateFormatted}. Submit today — submitting after the event date will be recorded as Late.`,
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
          console.error("Error inserting reminders:", insertError);
        } else {
          remindersSent = notifications.length;
        }
      }

      result = {
        action: "remind",
        targetDate: yesterdayStr,
        eventsChecked: events?.length || 0,
        remindersSent,
      };
    } else if (action === "mark_absent") {
      const twoDaysAgo = new Date(phNow);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().split("T")[0];

      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select(`
          id, title, event_date,
          event_assignments(user_id)
        `)
        .eq("event_date", twoDaysAgoStr);

      if (eventsError) throw eventsError;

      let absencesMarked = 0;
      const attendanceRecords: any[] = [];

      for (const event of (events || []) as Event[]) {
        for (const assignment of event.event_assignments || []) {
          const { data: existingAttendance } = await supabase
            .from("event_attendance")
            .select("id")
            .eq("event_id", event.id)
            .eq("user_id", assignment.user_id)
            .maybeSingle();

          if (!existingAttendance) {
            attendanceRecords.push({
              event_id: event.id,
              user_id: assignment.user_id,
              status: "absent",
              is_assigned: true,
              checked_in_at: null,
              notes: "Auto-marked absent (no attendance submitted)",
            });
          }
        }
      }

      if (attendanceRecords.length > 0) {
        const { error: insertError } = await supabase
          .from("event_attendance")
          .insert(attendanceRecords);

        if (insertError) {
          console.error("Error marking absences:", insertError);
        } else {
          absencesMarked = attendanceRecords.length;
        }
      }

      result = {
        action: "mark_absent",
        targetDate: twoDaysAgoStr,
        eventsChecked: events?.length || 0,
        absencesMarked,
      };
    }

    return new Response(
      JSON.stringify({
        message: `Attendance check completed`,
        ...result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in check-attendance:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
