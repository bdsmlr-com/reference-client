import { getStoredToken, setStoredToken, clearStoredToken } from './auth.js';
import type {
  SearchPostsByTagRequest,
  SearchPostsByTagResponse,
  ListBlogPostsRequest,
  ListBlogPostsResponse,
  ListBlogActivityRequest,
  ListBlogActivityResponse,
  ResolveIdentifierRequest,
  ResolveIdentifierResponse,
  ListPostLikesResponse,
  ListPostCommentsResponse,
  ListPostReblogsResponse,
  LoginResponse,
} from '../types/api.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const AUTH_EMAIL = import.meta.env.VITE_AUTH_EMAIL || '';
const AUTH_PASSWORD = import.meta.env.VITE_AUTH_PASSWORD || '';
const REQUEST_TIMEOUT = 15000;

let currentToken: string | null = null;

async function login(): Promise<string> {
  const resp = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify({ email: AUTH_EMAIL, password: AUTH_PASSWORD }),
  });

  const data: LoginResponse = await resp.json();

  if (data.error || !data.access_token) {
    throw new Error(data.error || 'Login failed');
  }

  setStoredToken(data.access_token, data.expires_in || 3600);
  currentToken = data.access_token;
  return data.access_token;
}

async function getToken(): Promise<string> {
  if (currentToken) {
    return currentToken;
  }

  const stored = getStoredToken();
  if (stored) {
    currentToken = stored;
    return stored;
  }

  return login();
}

async function apiRequest<T>(
  endpoint: string,
  body: unknown,
  retryOnAuth = true
): Promise<T> {
  const token = await getToken();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const resp = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      if (resp.status === 401 && retryOnAuth) {
        clearStoredToken();
        currentToken = null;
        await login();
        return apiRequest<T>(endpoint, body, false);
      }
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();

    if (data.error) {
      if (data.error.includes('token') && retryOnAuth) {
        clearStoredToken();
        currentToken = null;
        await login();
        return apiRequest<T>(endpoint, body, false);
      }
      throw new Error(data.error);
    }

    return data as T;
  } catch (e) {
    clearTimeout(timeout);
    if ((e as Error).name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw e;
  }
}

export async function searchPostsByTag(
  req: SearchPostsByTagRequest
): Promise<SearchPostsByTagResponse> {
  return apiRequest<SearchPostsByTagResponse>(
    '/v2/public-read-api-v2/search-posts-by-tag',
    req
  );
}

export async function listBlogPosts(
  req: ListBlogPostsRequest
): Promise<ListBlogPostsResponse> {
  return apiRequest<ListBlogPostsResponse>(
    '/v2/public-read-api-v2/list-blog-posts',
    req
  );
}

export async function listBlogFollowers(
  req: ListBlogActivityRequest
): Promise<ListBlogActivityResponse> {
  return apiRequest<ListBlogActivityResponse>(
    '/v2/public-read-api-v2/list-blog-followers',
    req
  );
}

export async function listBlogFollowing(
  req: ListBlogActivityRequest
): Promise<ListBlogActivityResponse> {
  return apiRequest<ListBlogActivityResponse>(
    '/v2/public-read-api-v2/list-blog-following',
    req
  );
}

export async function resolveIdentifier(
  req: ResolveIdentifierRequest
): Promise<ResolveIdentifierResponse> {
  return apiRequest<ResolveIdentifierResponse>(
    '/v2/public-read-api-v2/resolve-identifier',
    req
  );
}

export async function listPostLikes(
  postId: number
): Promise<ListPostLikesResponse> {
  return apiRequest<ListPostLikesResponse>(
    '/v2/public-read-api-v2/list-post-likes',
    { post_id: postId }
  );
}

export async function listPostComments(
  postId: number
): Promise<ListPostCommentsResponse> {
  return apiRequest<ListPostCommentsResponse>(
    '/v2/public-read-api-v2/list-post-comments',
    { post_id: postId }
  );
}

export async function listPostReblogs(
  postId: number
): Promise<ListPostReblogsResponse> {
  return apiRequest<ListPostReblogsResponse>(
    '/v2/public-read-api-v2/list-post-reblogs',
    { post_id: postId }
  );
}

export async function signUrl(url: string): Promise<string> {
  const data = await apiRequest<{ url?: string }>(
    '/v2/public-read-api-v2/sign-url',
    { url }
  );
  return data.url || url;
}

export async function checkImageExists(url: string): Promise<boolean> {
  try {
    const resp = await fetch(url, { method: 'HEAD', mode: 'cors' });
    return resp.ok;
  } catch {
    // CORS might block HEAD, assume exists
    return true;
  }
}
