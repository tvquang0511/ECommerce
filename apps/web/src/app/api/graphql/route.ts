import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(status: number, code: string, message: string, details?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error: { code, message, details } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function getUpstreamBaseUrl() {
  const raw =
    process.env.GRAPHQL_GATEWAY_URL ??
    (process.env.NODE_ENV !== 'production' ? 'http://localhost:4000' : undefined);

  if (!raw) {
    return { ok: false as const, message: 'Missing GRAPHQL_GATEWAY_URL' };
  }

  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { ok: false as const, message: 'GRAPHQL_GATEWAY_URL must start with http:// or https://' };
    }
  } catch {
    return { ok: false as const, message: 'GRAPHQL_GATEWAY_URL is not a valid URL' };
  }

  return { ok: true as const, baseUrl: raw.replace(/\/$/, '') };
}

async function proxy(request: NextRequest): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  const upstream = getUpstreamBaseUrl();
  if (!upstream.ok) {
    return jsonError(500, 'PROXY_MISCONFIGURED', upstream.message, {
      hint: 'Set GRAPHQL_GATEWAY_URL in apps/web/.env.local (e.g. http://localhost:4000).',
    });
  }

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');

  const host = request.headers.get('host');
  const proto = request.nextUrl.protocol.replace(':', '');
  if (host) headers.set('x-forwarded-host', host);
  headers.set('x-forwarded-proto', proto);

  const body = await request.arrayBuffer();
  const upstreamUrl = `${upstream.baseUrl}/graphql`;

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body,
    });
  } catch (err) {
    return jsonError(502, 'UPSTREAM_UNREACHABLE', 'Cannot reach graphql-gateway.', {
      upstreamUrl,
      error: String((err as Error)?.message ?? err),
    });
  }

  const responseHeaders = new Headers();
  upstreamResponse.headers.forEach((value, key) => {
    responseHeaders.set(key, value);
  });

  const data = await upstreamResponse.arrayBuffer();
  return new Response(data, { status: upstreamResponse.status, headers: responseHeaders });
}

export async function POST(request: NextRequest) {
  return proxy(request);
}

export async function OPTIONS(request: NextRequest) {
  return proxy(request);
}
