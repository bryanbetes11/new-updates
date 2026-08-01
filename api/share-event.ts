import shareEvent from '../netlify/functions/share-event.js';

type VercelRequest = {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  url?: string;
};

type VercelResponse = {
  end(body?: Uint8Array | string): void;
  setHeader(name: string, value: string): void;
  statusCode: number;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const url = new URL(req.url || '/', `${protocol}://${host}`);
  const match = url.pathname.match(/^\/share\/events\/([^/]+)(?:\/image)?$/);
  const token = url.searchParams.get('id') || match?.[1];
  const isImage = url.searchParams.get('mode') === 'image' || url.pathname.endsWith('/image');

  if (!token) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  const functionUrl = new URL(
    `/share/events/${encodeURIComponent(token)}${isImage ? '/image' : ''}`,
    `${protocol}://${host}`,
  );
  const preview = url.searchParams.get('preview');
  if (preview) functionUrl.searchParams.set('preview', preview);

  const headers = new Headers();
  Object.entries(req.headers).forEach(([name, value]) => {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value) headers.set(name, value);
  });

  const response = await shareEvent(
    new Request(functionUrl, { method: req.method, headers }),
    { params: { id: decodeURIComponent(token) } },
  );

  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(new Uint8Array(await response.arrayBuffer()));
}
