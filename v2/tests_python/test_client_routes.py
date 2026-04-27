from __future__ import annotations

import unittest
from pathlib import Path

from flask import Flask

from routes import client_blueprint, init_client_routes


def make_app() -> Flask:
    app = Flask(__name__)
    dist_dir = Path(__file__).resolve().parents[1] / "dist-dev"
    init_client_routes(str(dist_dir))
    app.register_blueprint(client_blueprint)
    return app


class ClientRoutesRedirectTests(unittest.TestCase):
    def test_legacy_blog_page_routes_301_to_canonical_routes(self) -> None:
        app = make_app()
        client = app.test_client()

        cases = {
            "/for": "/for/you",
            "/feed": "/feed/for/you",
            "/activity": "/activity/you",
            "/archive": "/archive/you",
            "/settings": "/settings/you",
            "/social": "/social/you/followers",
            "/social/you": "/social/you/followers",
            "/social/sam": "/social/sam/followers",
            "/sam/archive": "/archive/sam",
            "/sam/activity": "/activity/sam",
            "/sam/feed": "/feed/for/sam",
            "/sam/social": "/social/sam/followers",
        }

        for source, target in cases.items():
            response = client.get(source, follow_redirects=False)
            self.assertEqual(response.status_code, 301)
            self.assertTrue(response.headers["Location"].endswith(target))

    def test_legacy_social_query_tab_redirects_to_nested_social_routes(self) -> None:
        app = make_app()
        client = app.test_client()

        response = client.get("/sam/social?tab=followers", follow_redirects=False)
        self.assertEqual(response.status_code, 301)
        self.assertTrue(response.headers["Location"].endswith("/social/sam/followers"))

        response = client.get("/sam/social?tab=following", follow_redirects=False)
        self.assertEqual(response.status_code, 301)
        self.assertTrue(response.headers["Location"].endswith("/social/sam/following"))


if __name__ == "__main__":
    unittest.main()
