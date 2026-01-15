"""
BDSMLR Client Routing Blueprint

Import and register in your API server AFTER your API routes:

    # Register API routes first
    app.register_blueprint(api_blueprint)

    # Then register client routes
    from client.v2.routes import client_blueprint, init_client_routes
    init_client_routes('/path/to/client/v2/dist')
    app.register_blueprint(client_blueprint)

Configure via environment:
    ROUTING_MODE=path      # staging: /blogname/page/
    ROUTING_MODE=subdomain # production: blogname.bdsmlr.com/page/
"""

import os
from flask import Blueprint, send_from_directory, request

# Configuration
ROUTING_MODE = os.environ.get('ROUTING_MODE', 'path')

# Route definitions (mirrors client-side blog-resolver.ts)
STATIC_PAGES = ['search', 'blogs', 'home', 'clear-cache']
BLOG_PAGES = ['archive', 'timeline', 'following', 'social']
RESERVED_SUBDOMAINS = ['www', 'api', 'cdn', 'static', 'admin', 'app']

# Paths that should NOT be handled by client routes (API endpoints)
API_PREFIXES = ('v1', 'v2', 'api', 'auth', 'admin', 'health', 'metrics', 'static')

# Blueprint
client_blueprint = Blueprint('client', __name__)

# Dist paths - set by init_client_routes()
_dist_dir = None
_pages_dir = None


def init_client_routes(dist_path):
    """Initialize with path to dist folder. Call before registering blueprint."""
    global _dist_dir, _pages_dir
    _dist_dir = dist_path
    _pages_dir = os.path.join(dist_path, 'src', 'pages')


def _serve_page(page_name):
    """Serve HTML page from dist/src/pages/"""
    if not _pages_dir:
        raise RuntimeError("Call init_client_routes(dist_path) first")
    return send_from_directory(_pages_dir, f'{page_name}.html')


def _is_api_path(path):
    """Check if path should be handled by API, not client."""
    if not path:
        return False
    first_segment = path.lstrip('/').split('/')[0].lower()
    return first_segment in API_PREFIXES


def _get_subdomain():
    """Extract blog subdomain from host."""
    host = request.host.split(':')[0].lower()
    parts = host.split('.')
    if len(parts) < 3:
        return None
    subdomain = parts[0]
    if subdomain in RESERVED_SUBDOMAINS or subdomain.startswith('api'):
        return None
    return subdomain


# =============================================================================
# Static Assets (all modes)
# =============================================================================

@client_blueprint.route('/assets/<path:filename>')
def assets(filename):
    return send_from_directory(os.path.join(_dist_dir, 'assets'), filename)


# =============================================================================
# Catch-all route that handles all client paths
# =============================================================================

@client_blueprint.route('/', defaults={'path': ''})
@client_blueprint.route('/<path:path>')
def catch_all(path):
    """
    Catch-all route for client pages.
    Returns None for API paths (lets them 404 or be handled by API routes).
    """
    # Skip API paths entirely
    if _is_api_path(path):
        # Return 404 - API routes should be registered first and handle these
        from flask import abort
        abort(404)

    parts = path.strip('/').split('/') if path else []

    if ROUTING_MODE == 'subdomain':
        # Subdomain mode: blog name is in hostname
        subdomain = _get_subdomain()

        if not parts:
            # Root: archive for blog subdomain, home for main domain
            return _serve_page('archive' if subdomain else 'home')

        page = parts[0]
        if page in BLOG_PAGES or page in STATIC_PAGES:
            return _serve_page(page)

        return _serve_page('archive')

    else:
        # Path mode: /blogname/page/
        if not parts:
            return _serve_page('home')

        if len(parts) == 1:
            segment = parts[0]
            if segment in STATIC_PAGES:
                return _serve_page(segment)
            # Single segment = blog name, show archive
            return _serve_page('archive')

        # Two+ segments: /blogname/page/...
        page = parts[1]
        if page in BLOG_PAGES:
            return _serve_page(page)

        return _serve_page('archive')
