'use client';

import { useEffect } from 'react';

import { useAuthedUserService } from '@/lib/auth/useAuthedUserService';

// Bootstraps access token from refresh cookie (HttpOnly) once the app loads.
// Keeps header/account pages consistent after hard refresh/new tab.
export function AuthBootstrap() {
  const { ensureAccessToken } = useAuthedUserService();

  useEffect(() => {
    void ensureAccessToken();
  }, [ensureAccessToken]);

  return null;
}