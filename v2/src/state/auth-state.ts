export type AuthUser = { userId: number; blogId: number; username?: string; blogName?: string } | null;

let currentUser: AuthUser = null;

export const setAuthUser = (user: AuthUser) => {
  currentUser = user;
  window.dispatchEvent(new CustomEvent('auth-user-changed'));
};

export const clearAuthUser = () => {
  currentUser = null;
  window.dispatchEvent(new CustomEvent('auth-user-changed'));
};

export const getAuthUser = () => currentUser;
