import type { AuthUser } from '../state/auth-state.js';

export type PostAuthMode = 'unknown' | 'authenticated' | 'anonymous';

export function resolvePostAuthMode(input: {
  checkingAuth: boolean;
  authUser: AuthUser;
}): PostAuthMode {
  if (input.checkingAuth) {
    return 'unknown';
  }

  return input.authUser ? 'authenticated' : 'anonymous';
}
