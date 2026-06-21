from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

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
            "/activity": "/blog/you",
            "/blog": "/blog/you",
            "/archive": "/archive/you",
            "/settings": "/settings/you",
            "/social": "/social/you",
            "/sam/archive": "/archive/sam",
            "/sam/activity": "/blog/sam",
            "/sam/feed": "/feed/for/sam",
            "/sam/social": "/social/sam",
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

    def test_canonical_social_blog_routes_do_not_redirect_to_themselves(self) -> None:
        app = make_app()
        client = app.test_client()

        for source in ("/social/you", "/social/sam"):
            response = client.get(source, follow_redirects=False)
            self.assertNotEqual(response.status_code, 301)

    def test_v2_asset_namespace_is_served_by_the_client_blueprint(self) -> None:
        app = make_app()
        client = app.test_client()

        response = client.get("/v2/assets/does-not-exist.js", follow_redirects=False)
        self.assertEqual(response.status_code, 404)

    def test_v2_api_paths_are_not_swallowed_by_spa_catch_all(self) -> None:
        app = make_app()
        client = app.test_client()

        response = client.get("/v2/api/ping", follow_redirects=False)
        self.assertEqual(response.status_code, 404)

    def test_discovery_paths_do_not_fall_through_to_spa_html_when_dist_exists(self) -> None:
        with TemporaryDirectory() as tmp_dir:
            dist_dir = Path(tmp_dir)
            (dist_dir / "index.html").write_text("<html>spa</html>", encoding="utf-8")

            app = Flask(__name__)
            init_client_routes(str(dist_dir))
            app.register_blueprint(client_blueprint)
            client = app.test_client()

            for path in ("/robots.txt", "/sitemap.xml", "/auth.md", "/.well-known/api-catalog"):
                response = client.get(path, follow_redirects=False)

                self.assertEqual(response.status_code, 404, path)
                self.assertNotIn("<html>spa</html>", response.get_data(as_text=True), path)


if __name__ == "__main__":
    unittest.main()
