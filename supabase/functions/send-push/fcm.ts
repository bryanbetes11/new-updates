type ServiceAccount = { project_id: string; client_email: string; private_key: string };
type Message = { token: string; title: string; body: string; userId: string; notificationId?: string; url?: unknown; highPriority: boolean; ttl: number };
type Result = { ok: boolean; stale: boolean };

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const encode = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));

/** Only HTTP v1; credentials stay in Edge Function secrets, never in the APK. */
export function createFcmSender(rawCredentials: string | undefined, request: typeof fetch = fetch) {
  let cached: { token: string; expires: number } | null = null;
  let pending: Promise<string> | null = null;
  const credentials = () => {
    const account = JSON.parse(rawCredentials || '{}') as ServiceAccount;
    if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(account.project_id || '') || !account.client_email || !account.private_key) {
      throw new Error('FCM is not configured');
    }
    return account;
  };
  const accessToken = async (account: ServiceAccount): Promise<string> => {
    if (cached && cached.expires > Date.now() + 60000) return cached.token;
    if (pending) return pending;
    pending = (async () => {
      const now = Math.floor(Date.now() / 1000);
      const input = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
        iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
      })}`;
      const pem = account.private_key.replace(/-----[^-]+-----|\s/g, '');
      const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), char => char.charCodeAt(0)),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
      const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input)));
      const response = await request('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${input}.${base64url(signature)}` }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('FCM authorization failed');
      const value = await response.json();
      if (typeof value.access_token !== 'string') throw new Error('FCM authorization failed');
      cached = { token: value.access_token, expires: Date.now() + Math.min(Number(value.expires_in) || 3600, 3600) * 1000 };
      return cached.token;
    })();
    try { return await pending; } finally { pending = null; }
  };
  return async (message: Message): Promise<Result> => {
    try {
      const account = credentials();
      const token = await accessToken(account);
      const response = await request(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: {
          token: message.token,
          notification: { title: message.title, body: message.body },
          data: { user_id: message.userId, notification_id: message.notificationId || '',
            url: typeof message.url === 'string' && message.url.startsWith('/') ? message.url : '/notifications' },
          android: { priority: message.highPriority ? 'HIGH' : 'NORMAL', ttl: `${message.ttl}s`,
            notification: { channel_id: 'servesync_updates', icon: 'ic_stat_notification', sound: 'default',
              visibility: 'PRIVATE', ...(message.notificationId ? { tag: message.notificationId } : {}) } },
        } }),
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) return { ok: true, stale: false };
      if (response.status === 401) cached = null;
      const error = await response.json().catch(() => ({}));
      const stale = Array.isArray(error?.error?.details) && error.error.details.some((detail: Record<string, unknown>) =>
        detail['@type'] === 'type.googleapis.com/google.firebase.fcm.v1.FcmError' && detail.errorCode === 'UNREGISTERED');
      // A malformed payload / IAM error must never delete valid device registrations.
      return { ok: false, stale };
    } catch {
      // Do not log private keys, bearer tokens, device tokens, or member message bodies.
      console.error('[Push] Android delivery failed; check FCM configuration or connectivity.');
      return { ok: false, stale: false };
    }
  };
}
