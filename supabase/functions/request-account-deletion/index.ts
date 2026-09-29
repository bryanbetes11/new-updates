import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

function respond(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return respond(405, { error: "Method not allowed" });

  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return respond(401, { error: "Sign in required" });

  let body: { confirmation?: unknown };
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: "Invalid request" });
  }
  if (body.confirmation !== "DELETE MY ACCOUNT") {
    return respond(400, { error: "Account deletion was not confirmed" });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return respond(503, { error: "Deletion service unavailable" });

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.slice("Bearer ".length);
  const { data: { user }, error: userError } = await authClient.auth.getUser(token);
  if (userError || !user?.id || !user.email) return respond(401, { error: "Sign in again" });

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The database step is atomic: it records the request, removes tenant
  // membership, and stops push delivery without deleting shared records.
  const { data: requestId, error: queueError } = await admin.rpc(
    "queue_and_disable_account_deletion",
    { p_user_id: user.id, p_account_email: user.email },
  );
  if (queueError || !requestId) {
    console.error("Account deletion queue failed", queueError);
    return respond(503, { error: "Deletion request could not be recorded" });
  }

  // This blocks new sign-ins and refreshes. Existing access tokens may remain
  // valid until expiry, but the removed tenant membership blocks church RLS.
  const { error: banError } = await admin.auth.admin.updateUserById(user.id, {
    ban_duration: "876000h",
  });
  if (banError) {
    console.error("Account deletion sign-in ban failed", { requestId, message: banError.message });
    return respond(503, { error: "Request recorded, but sign-in could not be disabled. Contact support.", requestId });
  }

  return respond(200, { requestId, accessDisabled: true });
});
