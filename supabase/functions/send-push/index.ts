import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Internal-Secret",
};

interface PushPayload {
  notification_id?: string;
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

type OrgLookupRow = {
  org_id: string | null;
  organizations: { name: string | null } | { name: string | null }[] | null;
};

type PushSubscriptionRow = {
  id?: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
};

type NotificationRow = {
  id: string;
  org_id: string;
  type: string;
  priority: "low" | "normal" | "high" | "urgent";
  required: boolean;
};

type NotificationRule = {
  enabled: boolean;
  required: boolean;
  push_enabled: boolean;
  priority: "low" | "normal" | "high" | "urgent";
};

type NotificationPreference = {
  push_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
  timezone: string;
  muted_types: string[];
};

type PushRuntimeConfig = {
  webhook_secret: string | null;
  vapid_private_key: string | null;
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ||
  "BFYGuTCBpjfMJWQrMBpZmTvPBD5Qc-0oVoWjle5UI4PKwY3iTUYdmJMi1J2VpoVV4Dfzg_XizPv80Zg5NGTS6rI";

function secretsMatch(received: string | null, expected: string | null): boolean {
  if (!received || !expected || received.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < received.length; index += 1) {
    mismatch |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}

function normalizeOrganizationName(row: OrgLookupRow | null): string | null {
  const orgData = row?.organizations;
  if (!orgData) return null;
  if (Array.isArray(orgData)) return orgData[0]?.name?.trim() || null;
  return orgData.name?.trim() || null;
}

function resolvePushTitle(title: string, organizationName: string | null, type: string): string {
  if (type === "message" && organizationName) return organizationName;
  const normalized = title.trim();
  if (!normalized) return organizationName ? `ServeSync from ${organizationName}` : "ServeSync";
  if (!organizationName) return normalized;
  const suffix = `from ${organizationName}`;
  return normalized.includes(suffix) ? normalized : `${normalized} ${suffix}`;
}

function minutesSinceMidnight(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function isQuietHours(preference: NotificationPreference | null): boolean {
  if (!preference?.quiet_hours_enabled) return false;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: preference.timezone || "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
    const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
    const now = hour * 60 + minute;
    const start = minutesSinceMidnight(preference.quiet_start);
    const end = minutesSinceMidnight(preference.quiet_end);
    if (start === end) return true;
    return start < end ? now >= start && now < end : now >= start || now < end;
  } catch {
    return false;
  }
}

function pushOptions(priority: NotificationRow["priority"], type: string) {
  const urgency = type === "message" || priority === "urgent" || priority === "high"
    ? "high"
    : priority === "low" ? "low" : "normal";
  const TTL = priority === "urgent" ? 60 * 60 : priority === "low" ? 60 * 60 * 48 : 60 * 60 * 24;
  return { urgency, TTL } as const;
}

async function sendWebPush(
  subscription: PushSubscriptionRow,
  payload: { title: string; body: string; data?: Record<string, unknown> },
  priority: NotificationRow["priority"],
  type: string,
) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
      },
      JSON.stringify(payload),
      { ...pushOptions(priority, type), timeout: 5000 },
    );
    return { ok: true };
  } catch (error) {
    console.error("Push send error:", error);
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode?: number }).statusCode)
      : null;
    return {
      ok: false,
      statusCode,
      stale: statusCode === 404 || statusCode === 410,
      message: error instanceof Error ? error.message : "Unknown push error",
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );
    const { data: runtimeConfig, error: configError } = await supabase.rpc("get_push_runtime_config");
    if (configError) {
      console.error("[Push] Runtime configuration unavailable:", configError.message);
      return json({ error: "Push service is not configured" }, 503);
    }

    const config = runtimeConfig as PushRuntimeConfig;
    if (!secretsMatch(req.headers.get("x-internal-secret"), config.webhook_secret)) {
      return json({ error: "Unauthorized" }, 401);
    }

    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || config.vapid_private_key;
    if (!vapidPrivateKey) return json({ error: "Push service is not configured" }, 503);
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") || "mailto:admin@worshipportal.com",
      VAPID_PUBLIC_KEY,
      vapidPrivateKey,
    );

    const { notification_id, user_id, title, body, data }: PushPayload = await req.json();
    if (
      !user_id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user_id) ||
      (notification_id && !/^[0-9a-f-]{36}$/i.test(notification_id)) ||
      typeof title !== "string" || typeof body !== "string" || !title.trim() ||
      title.length > 160 || body.length > 1000
    ) return json({ error: "Invalid push payload" }, 400);

    const updateStatus = async (values: Record<string, unknown>) => {
      if (notification_id) await supabase.from("notifications").update(values).eq("id", notification_id);
    };

    const { data: profileOrgRow } = await supabase
      .from("profiles")
      .select("org_id, organizations(name)")
      .eq("id", user_id)
      .maybeSingle();
    const profile = (profileOrgRow as OrgLookupRow | null) ?? null;
    if (!profile?.org_id) {
      await updateStatus({ push_status: "failed" });
      return json({ error: "Recipient organization not found" }, 404);
    }

    let notification: NotificationRow | null = null;
    if (notification_id) {
      const { data: notificationRow } = await supabase
        .from("notifications")
        .select("id, org_id, type, priority, required")
        .eq("id", notification_id)
        .eq("user_id", user_id)
        .maybeSingle();
      notification = notificationRow as NotificationRow | null;
      if (!notification) return json({ error: "Notification not found" }, 404);
    }

    const type = notification?.type || String(data?.notification_type || "system");
    const [{ data: settings }, { data: ruleRow }, { data: preferenceRow }] = await Promise.all([
      supabase.from("notification_system_settings").select("push_delivery_enabled").eq("org_id", profile.org_id).maybeSingle(),
      supabase.from("notification_rules").select("enabled, required, push_enabled, priority").eq("org_id", profile.org_id).eq("type", type).maybeSingle(),
      supabase.from("notification_preferences").select("push_enabled, quiet_hours_enabled, quiet_start, quiet_end, timezone, muted_types").eq("user_id", user_id).maybeSingle(),
    ]);
    const rule = ruleRow as NotificationRule | null;
    const preference = preferenceRow as NotificationPreference | null;
    const required = notification?.required || rule?.required || false;

    const allowed = (settings?.push_delivery_enabled ?? true) &&
      (rule?.enabled ?? true) && (rule?.push_enabled ?? true) &&
      (preference?.push_enabled ?? true) &&
      (required || !preference?.muted_types?.includes(type));
    if (!allowed) {
      await updateStatus({ push_status: "not_requested" });
      return json({ message: "Push disabled by notification settings", sent: 0 });
    }

    if (!required && type !== "message" && isQuietHours(preference)) {
      await updateStatus({
        push_status: "deferred",
        scheduled_for: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
      return json({ message: "Push deferred during quiet hours", sent: 0 });
    }
    if (!required && type === "message" && isQuietHours(preference)) {
      return json({ message: "Chat push skipped during quiet hours", sent: 0 });
    }

    const organizationName = normalizeOrganizationName(profile);
    const resolvedTitle = resolvePushTitle(title, organizationName, type);
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key")
      .eq("user_id", user_id);
    if (!subscriptions?.length) {
      await updateStatus({ push_status: "no_subscription" });
      return json({ message: "No subscriptions found", sent: 0 });
    }

    const priority = notification?.priority || rule?.priority || "normal";
    const results = await Promise.all((subscriptions as PushSubscriptionRow[]).map(async (sub) => {
      const result = await sendWebPush(sub, { title: resolvedTitle, body, data }, priority, type);
      if (!result.ok && result.stale && sub.id) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
      return { sub, ...result };
    }));

    const sent = results.filter((result) => result.ok).length;
    const stale = results.filter((result) => result.stale).length;
    const deliverableFailures = results.filter((result) => !result.ok && !result.stale).length;
    const status = sent === subscriptions.length ? "sent" : sent > 0 ? "partial" : "failed";
    await updateStatus({
      push_status: status,
      push_sent_at: sent > 0 ? new Date().toISOString() : null,
    });

    return json({
      message: `Sent ${sent} push notifications`,
      sent,
      total: subscriptions.length,
      staleRemoved: stale,
      failed: deliverableFailures,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Push] Fatal error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
