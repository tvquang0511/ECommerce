'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { clearAccessToken, getAccessToken, setAccessToken, subscribeAccessToken } from './tokenStore';

type UseAccessTokenResult = {
  accessToken: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
};

export function useAccessToken(): UseAccessTokenResult {
  const accessToken = useSyncExternalStore(subscribeAccessToken, getAccessToken, () => null);

  const setToken = useCallback((token: string) => {
    setAccessToken(token);
  }, []);

  const clearToken = useCallback(() => {
    clearAccessToken();
  }, []);

  return { accessToken, setToken, clearToken };
}
