const ACCESS_TOKEN_KEY = 'accessToken';
const ACCESS_TOKEN_CHANGED_EVENT = 'ecommerce:access-token-changed';

function emitAccessTokenChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ACCESS_TOKEN_CHANGED_EVENT));
}

export function subscribeAccessToken(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(ACCESS_TOKEN_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener(ACCESS_TOKEN_CHANGED_EVENT, listener);
  };
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string) {
  window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  emitAccessTokenChanged();
}

export function clearAccessToken() {
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  emitAccessTokenChanged();
}
