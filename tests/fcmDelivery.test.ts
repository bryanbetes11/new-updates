import { createFcmSender } from '../supabase/functions/send-push/fcm';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const privateKey = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('pkcs8', keys.privateKey))));
const decode = (value: string) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
let oauthCalls = 0;
let sends = 0;
let failure: string | null = null;
const request: typeof fetch = async (input, options) => {
  if (String(input).includes('oauth2.googleapis.com')) {
    oauthCalls++;
    const assertion = new URLSearchParams(String(options?.body)).get('assertion')!;
    const [header, payload, signature] = assertion.split('.');
    assert(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', keys.publicKey, decode(signature), new TextEncoder().encode(`${header}.${payload}`)), 'OAuth JWT signature verifies');
    const claims = JSON.parse(new TextDecoder().decode(decode(payload)));
    assert(claims.scope === 'https://www.googleapis.com/auth/firebase.messaging', 'minimal FCM OAuth scope');
    return Response.json({ access_token: 'fake-access-token', expires_in: 3600 });
  }
  sends++;
  assert(String(input) === 'https://fcm.googleapis.com/v1/projects/servesync-test/messages:send', 'correct project endpoint');
  const body = JSON.parse(String(options?.body)).message;
  assert(body.notification.title === 'Test' && body.data.user_id === 'alice', 'visible notification and account-scoped tap data');
  assert(body.android.notification.channel_id === 'servesync_updates' && body.android.notification.visibility === 'PRIVATE', 'correct Android channel and lock-screen privacy');
  assert(!String(options?.body).includes(privateKey), 'private key never enters notification payload');
  if (failure) return Response.json({ error: { details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: failure }] } }, { status: 400 });
  return Response.json({ name: 'fake-message' });
};
const send = createFcmSender(JSON.stringify({ project_id: 'servesync-test', client_email: 'test@servesync-test.iam.gserviceaccount.com', private_key: `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----` }), request);
const message = { token: 'test-device-token', title: 'Test', body: 'Hello', userId: 'alice', highPriority: false, ttl: 3600 };
const results = await Promise.all([send(message), send(message)]);
assert(results.every(result => result.ok) && oauthCalls === 1 && sends === 2, 'concurrent sends share OAuth token acquisition');
failure = 'INVALID_ARGUMENT';
assert(!(await send(message)).stale, 'invalid payload does not delete a device');
failure = 'UNREGISTERED';
assert((await send(message)).stale, 'unregistered token is eligible for cleanup');
failure = 'SENDER_ID_MISMATCH';
assert(!(await send(message)).stale, 'configuration mismatch does not delete a device');
