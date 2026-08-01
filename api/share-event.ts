import shareEvent from '../netlify/functions/share-event';

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

  if (!match) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  const headers = new Headers();
  Object.entries(req.headers).forEach(([name, value]) => {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value) headers.set(name, value);
  });

  const response = await shareEvent(
    new Request(url, { method: req.method, headers }),
    { params: { id: decodeURIComponent(match[1]) } },
  );

  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(new Uint8Array(await response.arrayBuffer()));
}
