/**
 * Typed API error codes for reliable error detection.
 * Resolves ERR-001 (string-based error detection) and ERR-002 (no typed error codes).
 */

export enum ApiErrorCode {
  // Network errors
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  OFFLINE = 'OFFLINE',

  // Auth errors
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  AUTH_EXPIRED = 'AUTH_EXPIRED',

  // Server errors
  SERVER_ERROR = 'SERVER_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',

  // Client errors
  PARSE_ERROR = 'PARSE_ERROR',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Typed API error with error code for reliable detection.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode?: number;
  readonly endpoint?: string;
  readonly isRetryable: boolean;

  readonly cause?: Error;

  constructor(
    code: ApiErrorCode,
    message: string,
    options?: {
      statusCode?: number;
      endpoint?: string;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = options?.statusCode;
    this.endpoint = options?.endpoint;
    this.cause = options?.cause;

    // Determine if this error type is retryable
    this.isRetryable = isRetryableError(code);
  }

  /**
   * Check if this is a timeout error (replaces string-based detection)
   */
  isTimeout(): boolean {
    return this.code === ApiErrorCode.TIMEOUT;
  }

  /**
   * Check if this is a network error
   */
  isNetwork(): boolean {
    return (
      this.code === ApiErrorCode.NETWORK ||
      this.code === ApiErrorCode.OFFLINE ||
      this.code === ApiErrorCode.TIMEOUT
    );
  }

  /**
   * Check if this is an auth error
   */
  isAuth(): boolean {
    return (
      this.code === ApiErrorCode.AUTH_REQUIRED ||
      this.code === ApiErrorCode.AUTH_INVALID ||
      this.code === ApiErrorCode.AUTH_EXPIRED
    );
  }

  /**
   * Check if this is a server error (5xx)
   */
  isServer(): boolean {
    return this.code === ApiErrorCode.SERVER_ERROR;
  }

  /**
   * Get user-friendly message for display.
   * Provides actionable guidance beyond just describing the error.
   * Resolves ERR-004: generic error messages.
   */
  getUserMessage(): string {
    switch (this.code) {
      case ApiErrorCode.TIMEOUT:
        return 'The request took too long to complete. This may be due to a slow connection or high server load. Try again, or check if your internet connection is stable.';
      case ApiErrorCode.NETWORK:
        return 'Unable to connect to the server. Check your internet connection, disable any VPN or proxy that might be blocking the request, then try again.';
      case ApiErrorCode.OFFLINE:
        return 'You appear to be offline. Connect to the internet and try again. Any cached content will still be available.';
      case ApiErrorCode.SERVER_ERROR:
        return 'The server encountered an error processing your request. This is usually temporary. Wait a moment and try again, or check back later if the problem persists.';
      case ApiErrorCode.RATE_LIMITED:
        return 'You\'ve made too many requests in a short time. Wait 30-60 seconds before trying again. This limit protects the service from overload.';
      case ApiErrorCode.NOT_FOUND:
        return 'The requested content could not be found. It may have been deleted, moved, or the URL might be incorrect. Check the spelling and try again.';
      case ApiErrorCode.BAD_REQUEST:
        return 'The request was invalid. Check your input for typos or invalid characters and try again.';
      case ApiErrorCode.PARSE_ERROR:
        return 'The server response was corrupted or incomplete. This may be due to network issues. Try again, or check your connection.';
      case ApiErrorCode.AUTH_REQUIRED:
        return 'Authentication is required to access this content. Try refreshing the page. If the problem persists, clear your browser cache and reload.';
      case ApiErrorCode.AUTH_INVALID:
        return 'Your authentication credentials are invalid. Try refreshing the page, or clear your browser\'s site data and reload.';
      case ApiErrorCode.AUTH_EXPIRED:
        return 'Your session has expired. Refresh the page to log in again automatically.';
      default:
        return this.message || 'Something went wrong. Try refreshing the page or come back later.';
    }
  }

  /**
   * Get a shorter user-friendly message for inline display (toasts, small UI elements).
   * Use getUserMessage() for detailed guidance in error states.
   */
  getShortMessage(): string {
    switch (this.code) {
      case ApiErrorCode.TIMEOUT:
        return 'Request timed out - try again';
      case ApiErrorCode.NETWORK:
        return 'Connection failed - check your internet';
      case ApiErrorCode.OFFLINE:
        return 'You\'re offline';
      case ApiErrorCode.SERVER_ERROR:
        return 'Server error - try again later';
      case ApiErrorCode.RATE_LIMITED:
        return 'Too many requests - wait a moment';
      case ApiErrorCode.NOT_FOUND:
        return 'Not found';
      case ApiErrorCode.BAD_REQUEST:
        return 'Invalid request';
      case ApiErrorCode.PARSE_ERROR:
        return 'Corrupted response - try again';
      case ApiErrorCode.AUTH_REQUIRED:
      case ApiErrorCode.AUTH_INVALID:
      case ApiErrorCode.AUTH_EXPIRED:
        return 'Authentication error - refresh page';
      default:
        return 'Error - try again';
    }
  }
}

/**
 * Check if an error code represents a retryable condition
 */
function isRetryableError(code: ApiErrorCode): boolean {
  switch (code) {
    case ApiErrorCode.TIMEOUT:
    case ApiErrorCode.NETWORK:
    case ApiErrorCode.SERVER_ERROR:
    case ApiErrorCode.RATE_LIMITED:
      return true;
    default:
      return false;
  }
}

/**
 * Type guard to check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Convert any error to an ApiError
 */
export function toApiError(error: unknown, endpoint?: string): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (error instanceof Error) {
    // Check for abort/timeout
    if (error.name === 'AbortError') {
      return new ApiError(ApiErrorCode.TIMEOUT, 'Request timeout', {
        endpoint,
        cause: error,
      });
    }

    // Check for network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return new ApiError(ApiErrorCode.NETWORK, 'Network error', {
        endpoint,
        cause: error,
      });
    }

    // Legacy string-based detection fallback for any old errors
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout')) {
      return new ApiError(ApiErrorCode.TIMEOUT, error.message, {
        endpoint,
        cause: error,
      });
    }
    if (msg.includes('network') || msg.includes('fetch')) {
      return new ApiError(ApiErrorCode.NETWORK, error.message, {
        endpoint,
        cause: error,
      });
    }

    return new ApiError(ApiErrorCode.UNKNOWN, error.message, {
      endpoint,
      cause: error,
    });
  }

  return new ApiError(ApiErrorCode.UNKNOWN, String(error), { endpoint });
}

/**
 * Create an ApiError from an HTTP status code
 */
export function apiErrorFromStatus(
  status: number,
  message?: string,
  endpoint?: string
): ApiError {
  if (status === 401) {
    return new ApiError(ApiErrorCode.AUTH_REQUIRED, message || 'Unauthorized', {
      statusCode: status,
      endpoint,
    });
  }
  if (status === 403) {
    return new ApiError(ApiErrorCode.AUTH_INVALID, message || 'Forbidden', {
      statusCode: status,
      endpoint,
    });
  }
  if (status === 404) {
    return new ApiError(ApiErrorCode.NOT_FOUND, message || 'Not found', {
      statusCode: status,
      endpoint,
    });
  }
  if (status === 429) {
    return new ApiError(ApiErrorCode.RATE_LIMITED, message || 'Rate limited', {
      statusCode: status,
      endpoint,
    });
  }
  if (status >= 500) {
    return new ApiError(
      ApiErrorCode.SERVER_ERROR,
      message || `Server error (${status})`,
      {
        statusCode: status,
        endpoint,
      }
    );
  }
  if (status >= 400) {
    return new ApiError(
      ApiErrorCode.BAD_REQUEST,
      message || `Bad request (${status})`,
      {
        statusCode: status,
        endpoint,
      }
    );
  }

  return new ApiError(ApiErrorCode.UNKNOWN, message || `HTTP ${status}`, {
    statusCode: status,
    endpoint,
  });
}

/**
 * Operation types for context-aware error messages.
 */
export type ErrorOperation =
  | 'load_blog'
  | 'load_posts'
  | 'load_followers'
  | 'load_following'
  | 'search'
  | 'search_blogs'
  | 'resolve_blog';

/**
 * Standardized error messages for consistent UX across all pages.
 * Resolves UIC-005: Error message format varies.
 *
 * These constants ensure all pages display consistent, user-friendly messages
 * for common error scenarios. Use these instead of hardcoded strings.
 */
export const ErrorMessages = {
  /**
   * Validation errors - user input or URL parameter issues
   */
  VALIDATION: {
    NO_BLOG_SPECIFIED: 'No blog specified. Use ?blog=blogname in the URL.',
    NO_QUERY_SPECIFIED: 'Enter a search term to find content.',
    NO_TYPES_SELECTED: 'Please select at least one post type.',
    INVALID_BLOG_NAME: 'Blog name contains invalid characters. Use only letters, numbers, and hyphens.',
  },

  /**
   * Data integrity errors - API returned unexpected/incomplete data
   */
  DATA: {
    /**
     * When API returns a count but no actual data items
     * @param blogName - The blog name being queried
     * @param entityType - 'followers' or 'following'
     * @param count - The count returned by API
     */
    followDataMismatch: (blogName: string, entityType: 'followers' | 'following', count: number): string =>
      `Could not load ${entityType} data for @${blogName}. The API reported ${count} ${entityType} but returned no data. This may be a temporary issue - try again.`,

    BLOG_ID_NOT_RESOLVED: 'Unable to identify the blog. It may have been deleted or the name may be incorrect.',
  },

  /**
   * Blog resolution errors - when blog lookup fails
   */
  BLOG: {
    /**
     * Blog not found message with name
     * @param blogName - The blog name that wasn't found
     */
    notFound: (blogName: string): string =>
      `Blog "${blogName}" could not be found. Check if the blog name is spelled correctly, or the blog may have been deleted or renamed.`,

    NOT_FOUND_GENERIC: 'The specified blog could not be found. It may have been deleted or renamed.',
  },

  /**
   * Status messages - informational, not errors
   */
  STATUS: {
    /**
     * When a blog is not following anyone
     * @param blogName - The blog name
     */
    notFollowingAnyone: (blogName: string): string => `@${blogName} is not following any blogs.`,

    /**
     * When a blog has no followers
     * @param blogName - The blog name
     */
    noFollowers: (blogName: string): string => `@${blogName} has no followers.`,

    LOADING: 'Loading...',
    RESOLVING_BLOG: 'Resolving blog...',
  },
} as const;

/**
 * Get a context-aware error message based on the operation being performed.
 * Provides more specific guidance than generic error messages.
 *
 * @param error - The ApiError or any error object
 * @param operation - The operation that failed
 * @param context - Optional additional context (e.g., blog name)
 * @returns User-friendly error message with actionable guidance
 */
export function getContextualErrorMessage(
  error: unknown,
  operation: ErrorOperation,
  context?: { blogName?: string; query?: string }
): string {
  const apiError = isApiError(error) ? error : toApiError(error);
  const code = apiError.code;

  // Blog-specific NOT_FOUND messages
  if (code === ApiErrorCode.NOT_FOUND) {
    switch (operation) {
      case 'load_blog':
      case 'resolve_blog':
        if (context?.blogName) {
          return `Blog "${context.blogName}" could not be found. Check if the blog name is spelled correctly, or the blog may have been deleted or renamed.`;
        }
        return 'The specified blog could not be found. It may have been deleted or renamed.';
      case 'load_posts':
        return 'No posts found. The blog may be empty, private, or the posts may have been deleted.';
      case 'search':
        if (context?.query) {
          return `No results found for "${context.query}". Try different search terms, check spelling, or use fewer filters.`;
        }
        return 'No results found. Try different search terms or adjust your filters.';
      case 'search_blogs':
        if (context?.query) {
          return `No blogs found matching "${context.query}". Try a different search term or check the spelling.`;
        }
        return 'No blogs found. Try a different search term.';
      default:
        return apiError.getUserMessage();
    }
  }

  // Server errors with operation context
  if (code === ApiErrorCode.SERVER_ERROR) {
    switch (operation) {
      case 'load_followers':
      case 'load_following':
        return 'Unable to load connection data due to a server issue. This is a known intermittent problem. Please try again in a few moments.';
      case 'load_posts':
        return 'Unable to load posts due to a server issue. This is usually temporary. Please try again.';
      case 'search':
        return 'The search service is experiencing issues. Please try again in a moment.';
      default:
        return apiError.getUserMessage();
    }
  }

  // Timeout errors with operation context
  if (code === ApiErrorCode.TIMEOUT) {
    switch (operation) {
      case 'load_followers':
      case 'load_following':
        return 'Loading connections is taking longer than expected. This can happen for accounts with many followers. Try again or wait a moment.';
      case 'load_posts':
        return 'Loading posts is taking longer than expected. Try again with a slower connection, or reduce filters to load fewer results.';
      case 'search':
        return 'Search is taking too long. Try a more specific search term or reduce the number of filters.';
      default:
        return apiError.getUserMessage();
    }
  }

  // Default to the standard user message
  return apiError.getUserMessage();
}
