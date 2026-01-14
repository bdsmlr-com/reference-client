"""
BDSMLR Client Routing Blueprint

Import and register in your API server:

    from client.v2.routes import client_blueprint
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
STATIC_PAGES = ['search', 'blogs', 'home']
BLOG_PAGES = ['archive', 'timeline', 'following', 'social']
RESERVED_SUBDOMAINS = ['www', 'api', 'cdn', 'static', 'admin', 'app']

# Blueprint - dist path set when registered
client_blueprint = Blueprint('client', __name__)

# Will be set by init_client_routes()
_dist_dir = None
_pages_dir = None


def init_client_routes(dist_path):
    """
    Initialize the blueprint with the path to dist folder.
    Call this before registering the blueprint:

        from client.v2.routes import client_blueprint, init_client_routes
        init_client_routes('/path/to/client/v2/dist')
        app.register_blueprint(client_blueprint)
    """
    global _dist_dir, _pages_dir
    _dist_dir = dist_path
    _pages_dir = os.path.join(dist_path, 'src', 'pages')


def _serve_page(page_name):
    """Serve an HTML page from dist/src/pages/"""
    if not _pages_dir:
        raise RuntimeError("Call init_client_routes(dist_path) before registering blueprint")
    return send_from_directory(_pages_dir, f'{page_name}.html')


def _serve_asset(filename):
    """Serve static asset from dist/assets/"""
    if not _dist_dir:
        raise RuntimeError("Call init_client_routes(dist_path) before registering blueprint")
    return send_from_directory(os.path.join(_dist_dir, 'assets'), filename)


def _get_subdomain():
    """Extract subdomain from request host."""
    host = request.host.split(':')[0].lower()
    parts = host.split('.')
    if len(parts) < 3:
        return None
    subdomain = parts[0]
    if subdomain in RESERVED_SUBDOMAINS or subdomain.startswith('api'):
        return None
    return subdomain


# =============================================================================
# Static Assets
# =============================================================================

@client_blueprint.route('/assets/<path:filename>')
def assets(filename):
    return _serve_asset(filename)


# =============================================================================
# Routes - registered based on ROUTING_MODE
# =============================================================================

if ROUTING_MODE == 'subdomain':

    @client_blueprint.route('/')
    def root():
        if _get_subdomain():
            return _serve_page('archive')
        return _serve_page('home')

    @client_blueprint.route('/<page>/')
    @client_blueprint.route('/<page>')
    def page(page):
        if page in BLOG_PAGES or page in STATIC_PAGES:
            return _serve_page(page)
        return _serve_page('archive')

else:  # path mode (default)

    @client_blueprint.route('/')
    def root():
        return _serve_page('home')

    @client_blueprint.route('/<segment>/')
    @client_blueprint.route('/<segment>')
    def single_segment(segment):
        if segment in STATIC_PAGES:
            return _serve_page(segment)
        # Treat as blog name -> archive
        return _serve_page('archive')

    @client_blueprint.route('/<blogname>/<page>/')
    @client_blueprint.route('/<blogname>/<page>')
    def blog_page(blogname, page):
        if page in BLOG_PAGES:
            return _serve_page(page)
        return _serve_page('archive')
