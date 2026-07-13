import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, X-Internal-Secret",
};

interface PushPayload {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

type OrgLookupRow = {
  organizations: { name: string | null } | { name: string | null }[] | null;
};

type PushSubscriptionRow = {
  id?: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ||
  "BFYGuTCBpjfMJWQrMBpZmTvPBD5Qc-0oVoWjle5UI4PKwY3iTUYdmJMi1J2VpoVV4Dfzg_XizPv80Zg5NGTS6rI";

type PushRuntimeConfig = {
  webhook_secret: string | null;
  vapid_private_key: string | null;
};

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
  if (Array.isArray(orgData)) {
    return orgData[0]?.name?.trim() || null;
  }
  return orgData.name?.trim() || null;
}

function decorateTitleWithOrganization(title: string, organizationName: string | null): string {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) return organizationName ? `ServeSync from ${organizationName}` : "ServeSync";
  if (!organizationName) return normalizedTitle;
  const suffix = `from ${organizationName}`;
  return normalizedTitle.includes(suffix) ? normalizedTitle : `${normalizedTitle} ${suffix}`;
}

function resolvePushTitle(
  title: string,
  organizationName: string | null,
  notificationType: unknown,
): string {
  if (notificationType === "message" && organizationName) {
    return organizationName;
  }
  return decorateTitleWithOrganization(title, organizationName);
}

async function sendWebPush(
  subscription: PushSubscriptionRow,
  payload: { title: string; body: string; data?: Record<string, unknown> }
) {
  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth_key,
    },
  };

  try {
    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload),
      {
        TTL: 60 * 60 * 24,
        urgency: payload.data?.notification_type === "message" ? "high" : "normal",
        timeout: 5000,
      }
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

    const { data: runtimeConfig, error: configError } = await supabase
      .rpc("get_push_runtime_config");
    if (configError) {
      console.error("[Push] Runtime configuration unavailable:", configError.message);
      return new Response(JSON.stringify({ error: "Push service is not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = runtimeConfig as PushRuntimeConfig;
    if (!secretsMatch(req.headers.get("x-internal-secret"), config.webhook_secret)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || config.vapid_private_key;
    if (!vapidPrivateKey) {
      console.error("[Push] VAPID private key is not configured");
      return new Response(JSON.stringify({ error: "Push service is not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") || "mailto:admin@worshipportal.com",
      VAPID_PUBLIC_KEY,
      vapidPrivateKey,
    );

    const { user_id, title, body, data }: PushPayload = await req.json();
    console.log(`[Push] Received request for user ${user_id}: ${title}`);

    if (
      !user_id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user_id) ||
      typeof title !== "string" ||
      typeof body !== "string" ||
      title.trim().length === 0 ||
      title.length > 160 ||
      body.length > 1000
    ) {
      console.error("[Push] Missing required fields");
      return new Response(
        JSON.stringify({ error: "Invalid push payload" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: profileOrgRow } = await supabase
      .from("profiles")
      .select("organizations(name)")
      .eq("id", user_id)
      .maybeSingle();
    const organizationName = normalizeOrganizationName((profileOrgRow as OrgLookupRow | null) ?? null);
    const resolvedTitle = resolvePushTitle(title, organizationName, data?.notification_type);

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key")
      .eq("user_id", user_id);

    console.log(`[Push] Found ${subscriptions?.length || 0} subscriptions for user ${user_id}`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subscriptions found", sent: 0 }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results = await Promise.all((subscriptions as PushSubscriptionRow[]).map(async (sub) => {
      try {
        console.log(`[Push] Sending to endpoint: ${sub.endpoint.substring(0, 50)}...`);
        const result = await sendWebPush(sub, { title: resolvedTitle, body, data });
        if (!result.ok && result.stale && sub.id) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
        return { sub, ...result };
      } catch (err) {
        console.error("[Push] Error sending to subscription:", err);
        return {
          sub,
          ok: false,
          stale: false,
          message: err instanceof Error ? err.message : "Unknown push error",
        };
      }
    }));

    const sent = results.filter((result) => result.ok).length;
    const stale = results.filter((result) => result.stale).length;
    const errors = results
      .filter((result) => !result.ok && !result.stale)
      .map((result) => `Failed to send to ${result.sub.endpoint.substring(0, 30)}: ${result.message || "Unknown"}`);

    console.log(`[Push] Total sent: ${sent}/${subscriptions.length}`);
    if (stale > 0) {
      console.log(`[Push] Removed ${stale} stale subscriptions`);
    }
    if (errors.length > 0) {
      console.error("[Push] Errors:", errors);
    }

    return new Response(
      JSON.stringify({
        message: `Sent ${sent} push notifications`,
        sent,
        total: subscriptions.length,
        staleRemoved: stale,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Push] Fatal error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
