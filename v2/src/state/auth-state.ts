export type AuthBlog = { id: number; name: string };
export type AuthUser = {
  userId: number;
  blogId: number | null;
  username?: string | null;
  blogName?: string | null;
  blogs?: AuthBlog[];
  primaryBlogId?: number | null;
  activeBlogId?: number | null;
  activeBlogName?: string | null;
  capabilities?: string[];
} | null;

export type AuthState = {
  checkingAuth: boolean;
  authUser: AuthUser;
};

let currentAuthState: AuthState = {
  checkingAuth: false,
  authUser: null,
};

const emitAuthUserChanged = () => {
  window.dispatchEvent(new CustomEvent('auth-user-changed', { detail: currentAuthState.authUser }));
};

export const setAuthChecking = (checkingAuth: boolean) => {
  currentAuthState = {
    ...currentAuthState,
    checkingAuth,
  };
  emitAuthUserChanged();
};

export const setAuthUser = (user: AuthUser) => {
  currentAuthState = {
    checkingAuth: false,
    authUser: user,
  };
  emitAuthUserChanged();
};

export const clearAuthUser = () => {
  currentAuthState = {
    checkingAuth: false,
    authUser: null,
  };
  emitAuthUserChanged();
};

export const getAuthUser = () => currentAuthState.authUser;

export const getAuthState = (): AuthState => ({ ...currentAuthState });

export const isAuthCheckPending = () => currentAuthState.checkingAuth;

export const updateActiveBlog = (blogId: number, blogName?: string | null) => {
  const currentUser = currentAuthState.authUser;
  if (!currentUser) return;
  const resolvedName =
    blogName ||
    (currentUser.blogs || []).find((b) => b.id === blogId)?.name ||
    currentUser.blogName ||
    null;
  currentAuthState = {
    checkingAuth: currentAuthState.checkingAuth,
    authUser: {
      ...currentUser,
      blogId,
      blogName: resolvedName,
      activeBlogId: blogId,
      activeBlogName: resolvedName,
    },
  };
  emitAuthUserChanged();
};
