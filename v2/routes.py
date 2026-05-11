"""
BDSMLR SPA Client Routing Blueprint

Updated for SPA (Single Page Application) mode. 
Serves index.html for all non-asset and non-API paths.
"""

import os
from flask import Blueprint, send_from_directory, request, abort, redirect

# Blueprint
client_blueprint = Blueprint('client', __name__)

# Dist path - set by init_client_routes()
_dist_dir = None

# Paths that should NOT be handled by client routes (API endpoints)
API_PREFIXES = ('v1', 'v2', 'api', 'auth', 'admin', 'health', 'metrics', 'static')


def _canonical_redirect(path: str) -> str | None:
    normalized = '/' + path.lstrip('/')
    if normalized == '/for':
        return '/for/you'
    if normalized == '/feed':
        return '/feed/for/you'
    if normalized == '/activity':
        return '/activity/you'
    if normalized == '/archive':
        return '/archive/you'
    if normalized == '/settings':
        return '/settings/you'
    if normalized == '/social':
        return '/social/you'
    parts = [part for part in normalized.split('/') if part]
    if len(parts) == 2 and parts[0].lower() == 'social':
        tab = (request.args.get('tab') or '').lower()
        if tab in {'followers', 'following', 'siblings'}:
            return f'/social/{parts[1]}/{tab}'
        return f'/social/{parts[1]}'
    if len(parts) != 2:
        return None
    blog, page = parts[0], parts[1].lower()
    if page == 'archive':
        return f'/archive/{blog}'
    if page == 'activity':
        return f'/activity/{blog}'
    if page == 'feed':
        return f'/feed/for/{blog}'
    if page == 'social':
        tab = (request.args.get('tab') or '').lower()
        if tab in {'followers', 'following', 'siblings'}:
            return f'/social/{blog}/{tab}'
        return f'/social/{blog}'
    return None

def init_client_routes(dist_path):
    """Initialize with path to dist folder. Call before registering blueprint."""
    global _dist_dir
    _dist_dir = dist_path

def _is_api_path(path):
    """Check if path should be handled by API, not client."""
    if not path:
        return False
    first_segment = path.lstrip('/').split('/')[0].lower()
    return first_segment in API_PREFIXES

# =============================================================
# Static Assets
# =============================================================

@client_blueprint.route('/assets/<path:filename>')
def assets(filename):
    if not _dist_dir:
        abort(500, "Client routes not initialized")
    return send_from_directory(os.path.join(_dist_dir, 'assets'), filename)

@client_blueprint.route('/favicon.ico')
@client_blueprint.route('/robots.txt')
def root_assets():
    if not _dist_dir:
        abort(500, "Client routes not initialized")
    return send_from_directory(_dist_dir, request.path.lstrip('/'))

# =============================================================
# SPA Catch-all
# =============================================================

@client_blueprint.route('/', defaults={'path': ''})
@client_blueprint.route('/<path:path>')
def catch_all(path):
    """
    Catch-all route for SPA.
    Serves index.html for everything that isn't an API call.
    """
    if _is_api_path(path):
        abort(404)

    redirect_target = _canonical_redirect(path)
    if redirect_target:
        query = request.query_string.decode().strip()
        if query and not (redirect_target.startswith('/social/') and 'tab=' in query):
            redirect_target = f'{redirect_target}?{query}'
        return redirect(redirect_target, code=301)
    
    if not _dist_dir:
        abort(500, "Client routes not initialized")
        
    return send_from_directory(_dist_dir, 'index.html')
