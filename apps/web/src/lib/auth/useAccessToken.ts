'use client';

import { useCallback, useEffect, useState } from 'react';

import { clearAccessToken, getAccessToken, setAccessToken } from './tokenStore';

type UseAccessTokenResult = {
  accessToken: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
};

export function useAccessToken(): UseAccessTokenResult {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);

  useEffect(() => {
    setAccessTokenState(getAccessToken());
  }, []);

  const setToken = useCallback((token: string) => {
    setAccessToken(token);
    setAccessTokenState(token);
  }, []);

  const clearToken = useCallback(() => {
    clearAccessToken();
    setAccessTokenState(null);
  }, []);

  return { accessToken, setToken, clearToken };
}
