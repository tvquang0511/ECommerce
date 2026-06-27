import type { IncomingHttpHeaders } from 'node:http';

const FORWARDED_HEADER_ALLOWLIST = [
  'authorization',
  'x-request-id',
  'x-dev-user-id',
  'x-dev-roles',
  'x-dev-permissions',
  'x-dev-email',
  'x-dev-seller-status',
  'x-dev-kyc-verified',
] as const;

export function pickForwardHeaders(
  headers: IncomingHttpHeaders,
): Record<string, string> {
  const out: Record<string, string> = {};

  for (const name of FORWARDED_HEADER_ALLOWLIST) {
    const value = headers[name];
    if (typeof value === 'string' && value.trim()) {
      out[name] = value;
    }
  }

  return out;
}
