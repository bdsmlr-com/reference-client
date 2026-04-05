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
} | null;

let currentUser: AuthUser = null;

export const setAuthUser = (user: AuthUser) => {
  currentUser = user;
  window.dispatchEvent(new CustomEvent('auth-user-changed', { detail: user }));
};

export const clearAuthUser = () => {
  currentUser = null;
  window.dispatchEvent(new CustomEvent('auth-user-changed', { detail: null }));
};

export const getAuthUser = () => currentUser;

export const updateActiveBlog = (blogId: number, blogName?: string | null) => {
  if (!currentUser) return;
  const resolvedName =
    blogName ||
    (currentUser.blogs || []).find((b) => b.id === blogId)?.name ||
    currentUser.blogName ||
    null;
  currentUser = {
    ...currentUser,
    blogId,
    blogName: resolvedName,
    activeBlogId: blogId,
    activeBlogName: resolvedName,
  };
  window.dispatchEvent(new CustomEvent('auth-user-changed', { detail: currentUser }));
};
