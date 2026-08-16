import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Internal-Secret",
};

function secretsMatch(received: string | null, expected: string | null): boolean {
  if (!received || !expected || received.length !== expected.length) return false;

  let mismatch = 0;
  for (let index = 0; index < received.length; index += 1) {
    mismatch |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}

interface Assignment {
  user_id: string;
  status: string;
  profiles: { first_name: string; last_name: string } | null;
}

interface Event {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
  start_time: string | null;
  linked_event_id: string | null;
  event_assignments: Assignment[];
}

interface NotificationInsert {
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: {
    event_id?: string;
    session_id?: string;
    dedupe_key?: string;
    url: string;
  };
}

interface PendingScanSession {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

interface AttendanceInsert {
  event_id: string;
  user_id: string;
  status: "absent";
  is_assigned: boolean;
  checked_in_at: null;
  notes: string;
  record_source: "automatic";
  review_status: "needs_review";
}

function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function getManilaDateTime(eventDate: string, timeValue: string): Date {
  return new Date(`${eventDate}T${timeValue}+08:00`);
}

function isWithinMinute(now: Date, target: Date): boolean {
  const diff = now.getTime() - target.getTime();
  return diff >= 0 && diff < 60_000;
}

function formatTime12Hour(timeValue: string): string {
  const [hours, minutes] = timeValue.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const normalizedHour = hours % 12 || 12;
  return `${normalizedHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function getAccountableAssignments(event: Event): Assignment[] {
  const scheduledByUser = new Map<string, Assignment>();

  for (const assignment of event.event_assignments || []) {
    if (assignment.status === "declined") continue;
    scheduledByUser.set(assignment.user_id, assignment);
  }

  return Array.from(scheduledByUser.values());
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: expectedSecret, error: secretError } = await supabase
      .rpc("get_internal_webhook_secret", { p_purpose: "attendance_cron" });
    if (secretError || typeof expectedSecret !== "string") {
      console.error("Attendance webhook secret is unavailable:", secretError?.message);
      return new Response(JSON.stringify({ error: "Attendance service is not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!secretsMatch(req.headers.get("x-internal-secret"), expectedSecret)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "remind";

    const now = new Date();
    const manilaNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const phToday = manilaNow.toISOString().split("T")[0];

    let result: Record<string, string | number> = {};

    if (action === "timed_reminders") {
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select(`
          id, title, event_date, event_type, start_time, linked_event_id,
          event_assignments(user_id, status, profiles(first_name, last_name))
        `)
        .eq("event_date", phToday)
        .not("start_time", "is", null);

      if (eventsError) throw eventsError;

      let notificationsSent = 0;
      const notifications: NotificationInsert[] = [];

      for (const event of (events || []) as Event[]) {
        if (!event.start_time) continue;

        const isRehearsalLinked = event.event_type === "Rehearsal" && event.linked_event_id;
        const eventDisplay = isRehearsalLinked ? "Sunday Service Rehearsal" : event.title;
        const eventTimeFormatted = formatTime12Hour(event.start_time);
        const eventStart = getManilaDateTime(event.event_date, event.start_time);
        const openAt = new Date(eventStart.getTime() - 30 * 60 * 1000);
        const fiveMinutesBefore = new Date(eventStart.getTime() - 5 * 60 * 1000);
        const graceEndingSoon = new Date(eventStart.getTime() + 4 * 60 * 1000);

        for (const assignment of getAccountableAssignments(event)) {
          const { data: existingAttendance } = await supabase
            .from("event_attendance")
            .select("id")
            .eq("event_id", event.id)
            .eq("user_id", assignment.user_id)
            .maybeSingle();

          if (existingAttendance) continue;

          const reminderDefinitions = [
            {
              trigger: isWithinMinute(now, openAt),
              type: "attendance_open",
              title: "Church Attendance is Open",
              body: `Attendance for ${eventDisplay} is open. When you arrive at church, open ServeSync and scan the printed church QR.`,
            },
            {
              trigger: isWithinMinute(now, fiveMinutesBefore),
              type: "attendance_five_min_reminder",
              title: "Attendance Reminder",
              body: `${eventDisplay} starts at ${eventTimeFormatted}. If you are at church, scan the printed church QR and tap Check In.`,
            },
            {
              trigger: isWithinMinute(now, graceEndingSoon),
              type: "attendance_grace_final_reminder",
              title: "Present Grace Period Ending",
              body: `${eventDisplay} already started. Scan the church QR and tap Check In now; check-ins after the 5-minute grace period are recorded as Late.`,
            },
          ];

          for (const reminder of reminderDefinitions) {
            if (!reminder.trigger) continue;

            const existing = await supabase
              .from("notifications")
              .select("id")
              .eq("user_id", assignment.user_id)
              .eq("type", reminder.type)
              .eq("data->>event_id", event.id)
              .maybeSingle();

            if (!existing.data) {
              notifications.push({
                user_id: assignment.user_id,
                type: reminder.type,
                title: reminder.title,
                body: reminder.body,
                data: {
                  event_id: event.id,
                  url: "/attendance/scan",
                },
              });
            }
          }
        }
      }

      const incompleteThreshold = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
      const { data: pendingScanSessions, error: pendingScanError } = await supabase
        .from("attendance_qr_scan_sessions")
        .select("id, user_id, created_at, expires_at")
        .is("consumed_at", null)
        .lte("created_at", incompleteThreshold)
        .gt("expires_at", now.toISOString());

      if (pendingScanError) throw pendingScanError;

      for (const session of (pendingScanSessions || []) as PendingScanSession[]) {
        const dedupeKey = `attendance-scan-incomplete:${session.id}`;
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", session.user_id)
          .eq("dedupe_key", dedupeKey)
          .maybeSingle();

        if (!existing) {
          notifications.push({
            user_id: session.user_id,
            type: "attendance_scan_incomplete",
            title: "Finish Your Attendance Check-In",
            body: "You scanned the church QR but have not tapped Check In. Return to ServeSync before this scan expires.",
            data: {
              session_id: session.id,
              dedupe_key: dedupeKey,
              url: "/attendance/scan",
            },
          });
        }
      }

      if (notifications.length > 0) {
        const { error: insertError } = await supabase
          .from("notifications")
          .insert(notifications);

        if (insertError) {
          console.error("Error inserting timed attendance notifications:", insertError);
        } else {
          notificationsSent = notifications.length;
        }
      }

      result = {
        action: "timed_reminders",
        targetDate: phToday,
        eventsChecked: events?.length || 0,
        incompleteScansChecked: pendingScanSessions?.length || 0,
        notificationsSent,
      };
    } else if (["remind", "missed_evening", "missed_final"].includes(action)) {
      const targetDate = new Date(manilaNow);
      if (action !== "missed_evening") targetDate.setDate(targetDate.getDate() - 1);
      const targetDateStr = targetDate.toISOString().split("T")[0];

      const reminderType = action === "missed_evening"
        ? "attendance_missed_evening_reminder"
        : action === "missed_final"
        ? "attendance_missed_final_reminder"
        : "attendance_reminder";
      const reminderTitle = action === "missed_evening"
        ? "Attendance Still Missing"
        : action === "missed_final"
        ? "Attendance Not Submitted"
        : "Attendance Reminder";

      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select(`
          id, title, event_date, event_type, linked_event_id,
          event_assignments(user_id, status, profiles(first_name, last_name))
        `)
        .eq("event_date", targetDateStr);

      if (eventsError) throw eventsError;

      let remindersSent = 0;
      const notifications: NotificationInsert[] = [];

      for (const event of (events || []) as Event[]) {
        const isRehearsalLinked = event.event_type === "Rehearsal" && event.linked_event_id;
        const eventDisplay = isRehearsalLinked ? "Sunday Service Rehearsal" : event.title;
        const eventDateFormatted = formatDateLong(event.event_date);

        for (const assignment of getAccountableAssignments(event)) {
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
            .eq("type", reminderType)
            .eq("data->>event_id", event.id)
            .maybeSingle();

          if (!existingReminder.data) {
            notifications.push({
              user_id: assignment.user_id,
              type: reminderType,
              title: reminderTitle,
              body: action === "missed_evening"
                ? `No QR check-in is recorded for ${eventDisplay}. If you are still at church, scan the printed QR and tap Check In. Otherwise, contact a leader.`
                : action === "missed_final"
                ? `Final reminder: no QR check-in was recorded for ${eventDisplay} on ${eventDateFormatted}. It will be recorded as Absent under the attendance policy. Contact a leader today if you attended.`
                : `No QR check-in was recorded for ${eventDisplay} on ${eventDateFormatted}. Contact a leader if you attended and need the record reviewed.`,
              data: {
                event_id: event.id,
                url: action === "missed_evening" ? "/attendance/scan" : `/events/${event.id}`,
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
        action,
        targetDate: targetDateStr,
        eventsChecked: events?.length || 0,
        remindersSent,
      };
    } else if (action === "mark_absent") {
      const twoDaysAgo = new Date(manilaNow);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().split("T")[0];

      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select(`
          id, title, event_date,
          event_assignments(user_id, status)
        `)
        .eq("event_date", twoDaysAgoStr);

      if (eventsError) throw eventsError;

      let absencesMarked = 0;
      const attendanceRecords: AttendanceInsert[] = [];

      for (const event of (events || []) as Event[]) {
        for (const assignment of getAccountableAssignments(event)) {
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
              record_source: "automatic",
              review_status: "verified",
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
