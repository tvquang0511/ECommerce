'use client';

import { useCallback } from 'react';

import { useRouter } from 'next/navigation';

import { useAccessToken } from './useAccessToken';
import { userService, UserServiceError } from '@/lib/http/userService';

export function useAuthedUserService() {
  const router = useRouter();
  const { accessToken, setToken, clearToken } = useAccessToken();

  const ensureAccessToken = useCallback(async (): Promise<string | null> => {
    if (accessToken) return accessToken;

    try {
      const res = await userService.refresh();
      setToken(res.accessToken);
      return res.accessToken;
    } catch {
      return null;
    }
  }, [accessToken, setToken]);

  const authed = useCallback(
    async <T,>(fn: (token: string) => Promise<T>): Promise<T> => {
      const token = await ensureAccessToken();
      if (!token) {
        router.replace('/auth/login');
        throw new Error('AUTH_REQUIRED');
      }

      try {
        return await fn(token);
      } catch (err) {
        if (err instanceof UserServiceError && err.status === 401) {
          // Only refresh when access token is invalid/expired.
          // For business 401s (e.g. wrong current password), we should surface the error instead.
          if (err.code !== 'AUTH_TOKEN_INVALID') {
            throw err;
          }
          try {
            const refreshed = await userService.refresh();
            setToken(refreshed.accessToken);
            return await fn(refreshed.accessToken);
          } catch {
            clearToken();
            router.replace('/auth/login');
            throw new Error('AUTH_REQUIRED');
          }
        }
        throw err;
      }
    },
    [clearToken, ensureAccessToken, router, setToken],
  );

  const logout = useCallback(async () => {
    try {
      await userService.logout();
    } finally {
      clearToken();
      router.replace('/auth/login');
    }
  }, [clearToken, router]);

  const logoutAll = useCallback(async () => {
    await authed(async (token) => {
      await userService.logoutAll(token);
      return null;
    });

    clearToken();
    router.replace('/auth/login');
  }, [authed, clearToken, router]);

  return {
    accessToken,
    ensureAccessToken,
    authed,
    logout,
    logoutAll,
    setToken,
    clearToken,
  };
}
