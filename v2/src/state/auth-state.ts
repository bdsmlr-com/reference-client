export type AuthUser = { userId: number; blogId: number } | null;

let currentUser: AuthUser = null;

export const setAuthUser = (user: AuthUser) => {
  currentUser = user;
};

export const clearAuthUser = () => {
  currentUser = null;
};

export const getAuthUser = () => currentUser;
