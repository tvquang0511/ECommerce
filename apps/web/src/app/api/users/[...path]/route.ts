import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    path?: string[] | string;
  }>;
};

function jsonError(status: number, code: string, message: string, details?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ error: { code, message, details } }),
    {
      status,
      headers: { 'content-type': 'application/json' },
    },
  );
}

function getUpstreamBaseUrl(): { ok: true; baseUrl: string } | { ok: false; message: string } {
  const raw = process.env.USER_SERVICE_URL;
  if (!raw) {
    return { ok: false, message: 'Missing USER_SERVICE_URL' };
  }

  try {
    const parsed = new URL(raw);
    if (!parsed.protocol || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
      return { ok: false, message: 'USER_SERVICE_URL must start with http:// or https://' };
    }
  } catch {
    return { ok: false, message: 'USER_SERVICE_URL is not a valid URL' };
  }

  return { ok: true, baseUrl: raw.replace(/\/$/, '') };
}

async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  const upstream = getUpstreamBaseUrl();
  if (!upstream.ok) {
    return jsonError(500, 'PROXY_MISCONFIGURED', upstream.message, {
      hint: 'Set USER_SERVICE_URL in apps/web/.env (e.g. http://localhost:4001) and restart next dev server.',
    });
  }

  const upstreamBase = upstream.baseUrl;

  const resolvedParams = await context.params;
  const rawPath = resolvedParams?.path;
  const segments = Array.isArray(rawPath) ? rawPath : rawPath ? [rawPath] : [];
  const upstreamPath = `/api/users/${segments.map(encodeURIComponent).join('/')}`;
  const upstreamUrl = `${upstreamBase}${upstreamPath}${request.nextUrl.search}`;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');

  const host = request.headers.get('host');
  const proto = request.nextUrl.protocol.replace(':', '');
  if (host) headers.set('x-forwarded-host', host);
  headers.set('x-forwarded-proto', proto);

  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
    });
  } catch (err) {
    console.error('[web proxy] Upstream fetch failed', {
      upstreamUrl,
      method: request.method,
      error: String((err as any)?.message ?? err),
    });
    return jsonError(502, 'UPSTREAM_UNREACHABLE', 'Cannot reach user-service from Next.js proxy.', {
      upstreamUrl,
      hint: 'Ensure user-service is running and USER_SERVICE_URL is reachable from the Next.js process.',
    });
  }

  const responseHeaders = new Headers();
  upstreamResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    responseHeaders.set(key, value);
  });

  const setCookies: string[] =
    (upstreamResponse.headers as any).getSetCookie?.() ??
    (upstreamResponse.headers.get('set-cookie') ? [upstreamResponse.headers.get('set-cookie') as string] : []);

  for (const cookie of setCookies) {
    responseHeaders.append('set-cookie', cookie);
  }

  if (upstreamResponse.status === 204 || upstreamResponse.status === 304) {
    return new Response(null, { status: upstreamResponse.status, headers: responseHeaders });
  }

  const data = await upstreamResponse.arrayBuffer();
  return new Response(data, { status: upstreamResponse.status, headers: responseHeaders });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
