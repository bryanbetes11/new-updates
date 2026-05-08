import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PushPayload {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

const VAPID_PUBLIC_KEY = "BFYGuTCBpjfMJWQrMBpZmTvPBD5Qc-0oVoWjle5UI4PKwY3iTUYdmJMi1J2VpoVV4Dfzg_XizPv80Zg5NGTS6rI";
const VAPID_PRIVATE_KEY = "adWKInw27LTgLyKiRz4vOmZ78cJ6AyQ7XtOS6RGZrLo";

webpush.setVapidDetails(
  "mailto:admin@worshipportal.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth_key: string },
  payload: { title: string; body: string; data?: Record<string, string> }
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
      JSON.stringify(payload)
    );
    return true;
  } catch (error) {
    console.error("Push send error:", error);
    return false;
  }
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

    const { user_id, title, body, data }: PushPayload = await req.json();
    console.log(`[Push] Received request for user ${user_id}: ${title}`);

    if (!user_id || !title) {
      console.error("[Push] Missing required fields");
      return new Response(
        JSON.stringify({ error: "user_id and title are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
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

    let sent = 0;
    const errors: string[] = [];
    for (const sub of subscriptions) {
      try {
        console.log(`[Push] Sending to endpoint: ${sub.endpoint.substring(0, 50)}...`);
        const success = await sendWebPush(sub, { title, body, data });
        if (success) {
          sent++;
          console.log(`[Push] Successfully sent to subscription`);
        } else {
          errors.push(`Failed to send to ${sub.endpoint.substring(0, 30)}`);
        }
      } catch (err) {
        console.error("[Push] Error sending to subscription:", err);
        errors.push(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }

    console.log(`[Push] Total sent: ${sent}/${subscriptions.length}`);
    if (errors.length > 0) {
      console.error("[Push] Errors:", errors);
    }

    return new Response(
      JSON.stringify({
        message: `Sent ${sent} push notifications`,
        sent,
        total: subscriptions.length,
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
