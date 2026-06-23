export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export class UserServiceError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & {
    accessToken?: string | null;
  },
): Promise<T> {
  const url = path.startsWith('/') ? path : `/${path}`;

  const headers = new Headers(init?.headers);
  if (init?.accessToken) {
    headers.set('Authorization', `Bearer ${init.accessToken}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 204) {
    return undefined as any;
  }

  const contentType = res.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json') ? await parseJsonSafe(res) : await res.text();

  if (res.ok) {
    return data as T;
  }

  const payload = data as Partial<ApiErrorPayload> | undefined;
  const code = payload?.error?.code ?? 'UNKNOWN_ERROR';
  const message = payload?.error?.message ?? (typeof data === 'string' ? data : 'Request failed');
  const details = payload?.error?.details;
  throw new UserServiceError(res.status, code, message, details);
}

const USERS_API_PREFIX = '/api/users';
const AUTH_API_PREFIX = `${USERS_API_PREFIX}/auth`;

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  dateOfBirth: string | null;
  phoneNumber: string | null;
  gender: Gender | null;
};

export type RegisterResult = {
  requiresEmailVerification: true;
  challengeId: string;
  expiresAt: string;
  user: PublicUser;
  devOtp?: string;
};

export const userService = {
  register(input: { email: string; password: string; displayName: string }) {
    return request<RegisterResult>(
      `${AUTH_API_PREFIX}/register`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
  },

  login(input: { email: string; password: string }) {
    return request<
      | { accessToken: string; user: PublicUser }
      | { twoFactorRequired: true; challengeId: string; expiresAt: string; devOtp?: string }
    >(`${AUTH_API_PREFIX}/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  },

  verifyTwoFactor(input: { challengeId: string; code: string }) {
    return request<{ accessToken: string; user: PublicUser }>(
      `${AUTH_API_PREFIX}/2fa/verify`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
  },

  verifyEmail(input: { challengeId: string; code: string }) {
    return request<{ ok: true }>(`${AUTH_API_PREFIX}/verify-email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  },

  resendEmailVerification(input: { email: string }) {
    return request<{ ok: true; challengeId?: string; expiresAt?: string; devOtp?: string }>(
      `${AUTH_API_PREFIX}/verify-email/resend`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
  },

  me(accessToken: string) {
    return request<PublicUser>(
      `${AUTH_API_PREFIX}/me`,
      { method: 'GET', accessToken },
    );
  },

  usersMe(accessToken: string) {
    return request<PublicUser>(`${USERS_API_PREFIX}/me`, { method: 'GET', accessToken });
  },

  updateMe(accessToken: string, input: { displayName?: string }) {
    return request<PublicUser>(`${USERS_API_PREFIX}/me`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      accessToken,
    });
  },

  updateMeProfile(
    accessToken: string,
    input: {
      displayName?: string;
      bio?: string | null;
      dateOfBirth?: string | null;
      phoneNumber?: string | null;
      gender?: Gender | null;
    },
  ) {
    return request<PublicUser>(`${USERS_API_PREFIX}/me`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      accessToken,
    });
  },

  uploadAvatar(accessToken: string, avatar: File) {
    const body = new FormData();
    body.set('avatar', avatar);
    return request<PublicUser>(`${USERS_API_PREFIX}/me/avatar`, {
      method: 'POST',
      body,
      accessToken,
    });
  },

  refresh() {
    return request<{ accessToken: string }>(`${AUTH_API_PREFIX}/refresh`, { method: 'POST' });
  },

  logout() {
    return request<{ ok: true }>(`${AUTH_API_PREFIX}/logout`, { method: 'POST' });
  },

  logoutAll(accessToken: string) {
    return request<{ ok: true }>(`${AUTH_API_PREFIX}/logout-all`, { method: 'POST', accessToken });
  },

  listSessions(accessToken: string) {
    return request<{
      sessions: Array<{
        id: string;
        createdAt: string;
        lastUsedAt: string | null;
        revokedAt: string | null;
        createdByIp: string | null;
        createdByUserAgent: string | null;
        lastUsedIp: string | null;
        lastUsedUserAgent: string | null;
      }>;
    }>(`${AUTH_API_PREFIX}/sessions`, { method: 'GET', accessToken });
  },

  revokeSession(accessToken: string, sessionId: string) {
    return request<{ ok: true }>(`${AUTH_API_PREFIX}/sessions/${encodeURIComponent(sessionId)}/revoke`, {
      method: 'POST',
      accessToken,
    });
  },

  twoFactorStatus(accessToken: string) {
    return request<{ enabled: boolean }>(`${AUTH_API_PREFIX}/2fa`, { method: 'GET', accessToken });
  },

  enableTwoFactor(accessToken: string, input: { password: string }) {
    return request<{ enabled: true }>(
      `${AUTH_API_PREFIX}/2fa/enable`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
        accessToken,
      },
    );
  },

  disableTwoFactor(accessToken: string, input: { password: string }) {
    return request<{ enabled: false }>(
      `${AUTH_API_PREFIX}/2fa/disable`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
        accessToken,
      },
    );
  },

  forgotPassword(input: { email: string }) {
    return request<{ ok: true }>(
      `${AUTH_API_PREFIX}/forgot-password`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
  },

  resetPassword(input: { token: string; newPassword: string }) {
    return request<{ ok: true }>(
      `${AUTH_API_PREFIX}/reset-password`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
  },

  changePassword(accessToken: string, input: { currentPassword: string; newPassword: string }) {
    return request<{ ok: true }>(
      `${AUTH_API_PREFIX}/change-password`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
        accessToken,
      },
    );
  },
};
