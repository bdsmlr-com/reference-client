const TOKEN_KEY = 'bdsmlr_token';
const EXPIRY_KEY = 'bdsmlr_token_expiry';

export function getStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(EXPIRY_KEY);

  if (!token || !expiry) {
    return null;
  }

  const expiryTime = parseInt(expiry, 10);
  const now = Math.floor(Date.now() / 1000);

  // Token expired (with 60s buffer)
  if (now >= expiryTime - 60) {
    clearStoredToken();
    return null;
  }

  return token;
}

export function setStoredToken(token: string, expiresIn: number): void {
  const expiryTime = Math.floor(Date.now() / 1000) + expiresIn;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRY_KEY, expiryTime.toString());
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
}
