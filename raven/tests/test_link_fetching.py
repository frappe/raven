from types import SimpleNamespace
from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

import raven.safe_fetch as safe_fetch_module
from raven.link_fetcher import (
	MAX_FETCH_ATTEMPTS,
	PREVIEW_BOT_USER_AGENT,
	fetch_hacker_news,
	fetch_x,
	fill_preview,
	parse_markdown_preview,
	parse_open_graph,
)
from raven.links import _needs_fetch
from raven.safe_fetch import BlockedURLError, LinkFetchError, safe_fetch

PUBLIC_IP = "93.184.216.34"
HTML_HEADERS = {"Content-Type": "text/html"}


class FakeResponse:
	"""Just enough of a requests.Response for safe_fetch."""

	def __init__(self, status_code=200, headers=None, body=b""):
		self.status_code = status_code
		self.headers = headers or {}
		self._body = body

	def iter_content(self, chunk_size):
		for start in range(0, len(self._body), chunk_size):
			yield self._body[start : start + chunk_size]

	def close(self):
		pass


_real_resolve = safe_fetch_module.resolve_public_ip


def _stubbed_resolve(host, port):
	"""
	Fake DNS for hostnames so tests never touch the network. Literal IPs
	still go through the real validation — that is the code under test.
	"""
	import ipaddress

	try:
		ipaddress.ip_address(host)
	except ValueError:
		return PUBLIC_IP
	return _real_resolve(host, port)


class TestSafeFetch(IntegrationTestCase):
	def test_rejects_bad_schemes(self):
		for url in ("ftp://example.com/x", "file:///etc/passwd", "javascript:alert(1)"):
			with self.assertRaises(BlockedURLError, msg=url):
				safe_fetch(url, allowed_content_types=("text/html",))

	def test_rejects_private_addresses(self):
		# Literal IPs resolve without any network. Every one of these must
		# be refused before a single packet goes out.
		for url in (
			"http://127.0.0.1/x",
			"http://10.0.0.5/x",
			"http://192.168.1.1/x",
			"http://169.254.169.254/latest/meta-data/",
			"http://[::1]/x",
			"http://0.0.0.0/x",
			"http://100.64.0.1/x",
			"http://[::ffff:10.0.0.5]/x",
		):
			with self.assertRaises(BlockedURLError, msg=url):
				safe_fetch(url, allowed_content_types=("text/html",))

	def test_redirect_hops_are_revalidated(self):
		# The first host is fine. Its redirect points at the cloud metadata
		# IP, which must be caught on the second hop.
		redirect = FakeResponse(302, {"Location": "http://169.254.169.254/latest/"})
		with (
			patch.object(safe_fetch_module, "resolve_public_ip", side_effect=_stubbed_resolve),
			patch.object(safe_fetch_module, "_send_once", return_value=redirect),
		):
			with self.assertRaises(BlockedURLError):
				safe_fetch("https://example.com/page", allowed_content_types=("text/html",))

	def test_redirect_cap(self):
		redirect = FakeResponse(302, {"Location": "https://example.com/next"})
		with (
			patch.object(safe_fetch_module, "resolve_public_ip", side_effect=_stubbed_resolve),
			patch.object(safe_fetch_module, "_send_once", return_value=redirect),
		):
			with self.assertRaisesRegex(LinkFetchError, "redirects"):
				safe_fetch("https://example.com/page", allowed_content_types=("text/html",))

	def test_size_cap_on_streamed_body(self):
		big = FakeResponse(200, HTML_HEADERS, b"x" * 5000)
		with (
			patch.object(safe_fetch_module, "resolve_public_ip", side_effect=_stubbed_resolve),
			patch.object(safe_fetch_module, "_send_once", return_value=big),
		):
			with self.assertRaisesRegex(LinkFetchError, "too large"):
				safe_fetch("https://example.com/big", allowed_content_types=("text/html",), max_bytes=1000)

	def test_size_cap_on_declared_length(self):
		headers = {"Content-Type": "text/html", "Content-Length": "9999999"}
		response = FakeResponse(200, headers, b"tiny")
		with (
			patch.object(safe_fetch_module, "resolve_public_ip", side_effect=_stubbed_resolve),
			patch.object(safe_fetch_module, "_send_once", return_value=response),
		):
			with self.assertRaisesRegex(LinkFetchError, "too large"):
				safe_fetch("https://example.com/big", allowed_content_types=("text/html",), max_bytes=1000)

	def test_content_type_allowlist(self):
		response = FakeResponse(200, {"Content-Type": "image/png"}, b"png")
		with (
			patch.object(safe_fetch_module, "resolve_public_ip", side_effect=_stubbed_resolve),
			patch.object(safe_fetch_module, "_send_once", return_value=response),
		):
			with self.assertRaisesRegex(LinkFetchError, "not allowed"):
				safe_fetch("https://example.com/img", allowed_content_types=("text/html",))

	def test_successful_fetch(self):
		response = FakeResponse(200, {"Content-Type": "text/html; charset=utf-8"}, b"<html>hi</html>")
		with (
			patch.object(safe_fetch_module, "resolve_public_ip", side_effect=_stubbed_resolve),
			patch.object(safe_fetch_module, "_send_once", return_value=response),
		):
			result = safe_fetch("https://example.com/page", allowed_content_types=("text/html",))
		self.assertEqual(result.content_type, "text/html")
		self.assertEqual(result.body, b"<html>hi</html>")
		self.assertEqual(result.url, "https://example.com/page")


class TestOpenGraphParse(IntegrationTestCase):
	def test_parse_open_graph(self):
		html = b"""
		<html><head>
		<title>Fallback Title</title>
		<meta property="og:title" content="OG Title"/>
		<meta property="og:image" content="/img.png"/>
		<meta property="og:image:width" content="640"/>
		<meta property="og:image:height" content="360"/>
		<meta name="description" content="A page"/>
		</head></html>
		"""
		data = parse_open_graph(html, "https://example.com/post")
		self.assertEqual(data["title"], "OG Title")
		self.assertEqual(data["description"], "A page")
		# Relative image resolves against the page URL.
		self.assertEqual(data["image"], "https://example.com/img.png")
		self.assertEqual(data["image_width"], 640)
		self.assertEqual(data["image_height"], 360)
		self.assertEqual(data["site_name"], "example.com")

	def test_title_falls_back_to_title_tag(self):
		data = parse_open_graph(
			b"<html><head><title>Plain</title></head></html>", "https://example.com/"
		)
		self.assertEqual(data["title"], "Plain")

	def test_image_falls_back_to_plain_meta_name(self):
		# Some blogs declare only <meta name="image"> — no og: or twitter:
		# prefix. Same informal fallback the description chain uses.
		html = b"""
		<html><head>
		<meta property="og:title" content="Post"/>
		<meta name="image" content="https://example.com/cover.png"/>
		</head></html>
		"""
		data = parse_open_graph(html, "https://example.com/post")
		self.assertEqual(data["image"], "https://example.com/cover.png")

	def test_image_url_with_raw_spaces_is_percent_encoded(self):
		# Real case: a frappe.io page shipped a filename with spaces in its
		# image meta tag. Browsers forgive that; the dimension probe's HTTP
		# request must not.
		html = b"""
		<html><head>
		<meta name="image" content="https://example.com/files/a embed -Shot 12.00.08 PM.png"/>
		</head></html>
		"""
		data = parse_open_graph(html, "https://example.com/post")
		self.assertEqual(
			data["image"], "https://example.com/files/a%20embed%20-Shot%2012.00.08%20PM.png"
		)

	def test_image_url_with_narrow_no_break_space_is_percent_encoded(self):
		# macOS screenshot filenames put a narrow no-break space (U+202F)
		# before "AM"/"PM". It looks exactly like a space, and copy-paste
		# turns it into one — which points at a different file that 404s.
		# We must encode the true character (%E2%80%AF), not a plain space.
		html = (
			'<html><head><meta name="image" '
			'content="https://example.com/files/Screenshot at 12.00.08' + "\u202f" + 'PM.png"/>'
			"</head></html>"
		).encode("utf-8")
		data = parse_open_graph(html, "https://example.com/post")
		self.assertEqual(
			data["image"],
			"https://example.com/files/Screenshot%20at%2012.00.08%E2%80%AFPM.png",
		)

	def test_already_encoded_image_url_is_not_double_encoded(self):
		html = b"""
		<html><head>
		<meta property="og:image" content="https://example.com/a%20b.png"/>
		</head></html>
		"""
		data = parse_open_graph(html, "https://example.com/post")
		self.assertEqual(data["image"], "https://example.com/a%20b.png")

	def test_json_ld_extraction(self):
		# The shape Frappe's blog (and most articles) use: BlogPosting with
		# an author object and a publish date.
		html = b"""
		<html><head>
		<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "BlogPosting",
			"headline": "A Post",
			"author": {"@type": "Person", "name": "Jai Chavan"},
			"publisher": {"@type": "Organization", "name": "Frappe"},
			"datePublished": "2026-08-01"
		}
		</script>
		</head></html>
		"""
		data = parse_open_graph(html, "https://frappe.io/blog/post")
		self.assertEqual(
			data["metadata"],
			{
				"type": "BlogPosting",
				"author": "Jai Chavan",
				"published_on": "2026-08-01",
				"publisher": "Frappe",
			},
		)

	def test_json_ld_handles_graphs_and_author_lists(self):
		html = b"""
		<html><head>
		<script type="application/ld+json">
		{
			"@graph": [
				{"@type": "WebSite", "name": "Some Site"},
				{"@type": "Article", "author": [{"name": "A"}, {"name": "B"}], "datePublished": "2026-01-05"}
			]
		}
		</script>
		</head></html>
		"""
		data = parse_open_graph(html, "https://example.com/post")
		self.assertEqual(data["metadata"]["author"], "A, B")
		self.assertEqual(data["metadata"]["published_on"], "2026-01-05")

	def test_json_ld_type_can_be_a_list(self):
		html = b"""
		<html><head>
		<script type="application/ld+json">
		{"@type": ["Article", "NewsArticle"], "author": "Jane", "datePublished": "2026-02-02"}
		</script>
		</head></html>
		"""
		data = parse_open_graph(html, "https://example.com/")
		self.assertEqual(data["metadata"]["type"], "Article")

	def test_json_ld_junk_is_ignored(self):
		# Broken JSON, and a valid node with nothing card-worthy — both
		# produce no metadata rather than errors.
		html = b"""
		<html><head>
		<script type="application/ld+json">{not json</script>
		<script type="application/ld+json">{"@type": "WebSite", "name": "Just a site"}</script>
		</head></html>
		"""
		data = parse_open_graph(html, "https://example.com/")
		self.assertEqual(data["metadata"], {})


class TestMarkdownParse(IntegrationTestCase):
	def test_heading_and_first_paragraph(self):
		md = b"""# The philosophy of pay

How to build an **institution** without [tyranny](https://example.com).

More text here.
"""
		data = parse_markdown_preview(md, "https://vercel.com/blog/pay")
		self.assertEqual(data["title"], "The philosophy of pay")
		self.assertEqual(data["description"], "How to build an institution without tyranny.")
		self.assertEqual(data["site_name"], "vercel.com")

	def test_frontmatter_title_wins(self):
		md = b"""---
title: "From Frontmatter"
date: 2026-08-01
---

# Body Heading

First paragraph.
"""
		data = parse_markdown_preview(md, "https://example.com/post")
		self.assertEqual(data["title"], "From Frontmatter")
		self.assertEqual(data["description"], "First paragraph.")

	def test_image_lines_do_not_become_the_description(self):
		md = b"# Title\n\n![hero image](https://example.com/img.png)\n\nReal first paragraph.\n"
		data = parse_markdown_preview(md, "https://example.com/post")
		self.assertEqual(data["title"], "Title")
		self.assertEqual(data["description"], "Real first paragraph.")


class TestHackerNews(IntegrationTestCase):
	def fake_item(self, payload: dict):
		import json as json_module

		return SimpleNamespace(
			url="https://hacker-news.firebaseio.com/v0/item/1.json",
			content_type="application/json",
			body=json_module.dumps(payload).encode(),
		)

	def test_story(self):
		item = self.fake_item(
			{
				"type": "story",
				"title": "Show HN: Raven",
				"by": "nikhil",
				"score": 128,
				"descendants": 42,
				"time": 1786236000,
			}
		)
		with patch("raven.link_fetcher.safe_fetch", return_value=item) as fetch:
			data = fetch_hacker_news("https://news.ycombinator.com/item?id=44001")

		# The API is called with the item id from the link.
		self.assertIn("/v0/item/44001.json", fetch.call_args[0][0])
		self.assertEqual(data["title"], "Show HN: Raven")
		self.assertEqual(data["site_name"], "Hacker News")
		self.assertEqual(data["metadata"]["author"], "nikhil")
		self.assertEqual(data["metadata"]["points"], 128)
		self.assertEqual(data["metadata"]["comments"], 42)
		self.assertTrue(data["metadata"]["published_on"].startswith("2026-"))

	def test_comment(self):
		item = self.fake_item({"type": "comment", "by": "pg", "text": "Nice <i>work</i>!"})
		with patch("raven.link_fetcher.safe_fetch", return_value=item):
			data = fetch_hacker_news("https://news.ycombinator.com/item?id=2")

		self.assertEqual(data["title"], "Comment by pg")
		self.assertEqual(data["description"], "Nice work !")

	def test_non_item_pages_fall_through(self):
		# No API call for the front page or user pages — the caller falls
		# back to a page scrape.
		with patch("raven.link_fetcher.safe_fetch") as fetch:
			self.assertIsNone(fetch_hacker_news("https://news.ycombinator.com/"))
			self.assertIsNone(fetch_hacker_news("https://news.ycombinator.com/user?id=pg"))
			self.assertIsNone(fetch_hacker_news("https://news.ycombinator.com/item?id=abc"))
		fetch.assert_not_called()


class TestXStrategy(IntegrationTestCase):
	def oembed_response(self):
		import json as json_module

		payload = {
			"author_name": "Nikhil",
			"html": "<blockquote>hello world</blockquote>",
			"provider_name": "X",
		}
		return SimpleNamespace(
			url="https://publish.twitter.com/oembed",
			content_type="application/json",
			body=json_module.dumps(payload).encode(),
		)

	def test_merges_oembed_text_with_scraped_image(self):
		page = SimpleNamespace(
			url="https://x.com/nikhil/status/1",
			content_type="text/html",
			body=(
				b'<meta property="og:image" content="https://pbs.twimg.com/img.jpg"/>'
				b'<meta property="og:image:width" content="1200"/>'
				b'<meta property="og:image:height" content="675"/>'
			),
		)
		with patch("raven.link_fetcher.safe_fetch", side_effect=[self.oembed_response(), page]) as fetch:
			data = fetch_x("https://x.com/nikhil/status/1")

		# Text from oEmbed, image from the page scrape.
		self.assertEqual(data["title"], "Nikhil")
		self.assertEqual(data["description"], "hello world")
		self.assertEqual(data["image"], "https://pbs.twimg.com/img.jpg")
		self.assertEqual(data["image_width"], 1200)
		# The scrape presents as a preview crawler — X gates its meta
		# tags on that.
		self.assertEqual(fetch.call_args_list[1].kwargs.get("user_agent"), PREVIEW_BOT_USER_AGENT)

	def test_tweet_text_keeps_line_breaks_and_drops_attribution(self):
		import json as json_module

		# Real oEmbed shape: the tweet lives in the <p> (with <br> line
		# breaks); the rest of the blockquote is an attribution tail the
		# title already covers.
		payload = {
			"author_name": "Nikhil",
			"html": (
				'<blockquote><p lang="en">line one<br>line two</p>'
				"&mdash; Nikhil (@nikhil) "
				'<a href="https://x.com/nikhil/status/3">August 17, 2026</a></blockquote>'
			),
			"provider_name": "X",
		}
		oembed = SimpleNamespace(
			url="https://publish.twitter.com/oembed",
			content_type="application/json",
			body=json_module.dumps(payload).encode(),
		)
		page_error = LinkFetchError("no page")
		with patch("raven.link_fetcher.safe_fetch", side_effect=[oembed, page_error]):
			data = fetch_x("https://x.com/nikhil/status/3")

		self.assertEqual(data["description"], "line one\nline two")

	def test_avatar_og_image_is_dropped(self):
		# A tweet with no media serves the AUTHOR'S AVATAR as og:image
		# (under /profile_images/). The card must not banner a giant
		# profile picture — keep the text, drop the image.
		page = SimpleNamespace(
			url="https://x.com/nikhil/status/2",
			content_type="text/html",
			body=(
				b'<meta property="og:image" '
				b'content="https://pbs.twimg.com/profile_images/12345/nikhil_400x400.jpg"/>'
			),
		)
		with patch("raven.link_fetcher.safe_fetch", side_effect=[self.oembed_response(), page]):
			data = fetch_x("https://x.com/nikhil/status/2")

		self.assertEqual(data["description"], "hello world")
		self.assertFalse(data.get("image"))

	def test_image_scrape_is_best_effort(self):
		# The scrape failing must not cost the tweet its text.
		with patch(
			"raven.link_fetcher.safe_fetch",
			side_effect=[self.oembed_response(), LinkFetchError("wall")],
		):
			data = fetch_x("https://x.com/nikhil/status/1")

		self.assertEqual(data["title"], "Nikhil")
		self.assertEqual(data["description"], "hello world")
		self.assertEqual(data["image"], "")


class TestFillPreview(IntegrationTestCase):
	def make_preview(self):
		preview = frappe.new_doc("Raven Link Preview")
		# The url column is unique, and rows from an earlier test run can
		# survive in the DB. A fresh URL per call keeps runs independent.
		preview.url = f"https://example.com/{frappe.generate_hash(length=12)}"
		preview.provider = "Other"
		preview.status = "Pending"
		preview.insert(ignore_permissions=True)
		return preview

	def test_success_fills_and_marks_fetched(self):
		page = SimpleNamespace(
			url="https://example.com/article",
			content_type="text/html",
			body=b'<meta property="og:title" content="Hello"/>',
		)
		preview = self.make_preview()
		with patch("raven.link_fetcher.safe_fetch", return_value=page):
			self.assertTrue(fill_preview(preview))

		self.assertEqual(preview.status, "Fetched")
		self.assertEqual(preview.title, "Hello")
		self.assertTrue(preview.stale_after)
		self.assertFalse(preview.fetch_error)

	def _png_bytes(self, width: int, height: int) -> bytes:
		import io

		from PIL import Image

		buffer = io.BytesIO()
		Image.new("RGB", (width, height)).save(buffer, format="PNG")
		return buffer.getvalue()

	def test_image_without_declared_dims_is_probed_and_measured(self):
		# The page declares og:image but no og:image:width/height —
		# frappe.io's blog does exactly this. The fetcher downloads the
		# image and measures it, so the card can reserve the exact box.
		page = SimpleNamespace(
			url="https://example.com/article",
			content_type="text/html",
			body=(
				b'<meta property="og:title" content="Hello"/>'
				b'<meta property="og:image" content="https://example.com/cover.png"/>'
			),
		)
		cover = SimpleNamespace(
			url="https://example.com/cover.png",
			content_type="image/png",
			body=self._png_bytes(640, 360),
		)

		def fake_fetch(url, **_kwargs):
			return cover if url.endswith(".png") else page

		preview = self.make_preview()
		with patch("raven.link_fetcher.safe_fetch", side_effect=fake_fetch):
			self.assertTrue(fill_preview(preview))

		self.assertEqual(preview.image_width, 640)
		self.assertEqual(preview.image_height, 360)

	def test_declared_dims_skip_the_probe(self):
		page = SimpleNamespace(
			url="https://example.com/article",
			content_type="text/html",
			body=(
				b'<meta property="og:title" content="Hello"/>'
				b'<meta property="og:image" content="https://example.com/cover.png"/>'
				b'<meta property="og:image:width" content="1200"/>'
				b'<meta property="og:image:height" content="630"/>'
			),
		)
		preview = self.make_preview()
		with patch("raven.link_fetcher.safe_fetch", return_value=page) as fetch:
			self.assertTrue(fill_preview(preview))

		# One call: the page. No second call for the image.
		self.assertEqual(fetch.call_count, 1)
		self.assertEqual(preview.image_width, 1200)
		self.assertEqual(preview.image_height, 630)

	def test_oversized_canvas_skips_measuring(self):
		# Decompression-bomb guard: a small file can decode to a huge
		# canvas. The cap is patched down so the test image stays tiny.
		page = SimpleNamespace(
			url="https://example.com/article",
			content_type="text/html",
			body=(
				b'<meta property="og:title" content="Hello"/>'
				b'<meta property="og:image" content="https://example.com/cover.png"/>'
			),
		)
		cover = SimpleNamespace(
			url="https://example.com/cover.png",
			content_type="image/png",
			body=self._png_bytes(64, 64),
		)

		def fake_fetch(url, **_kwargs):
			return cover if url.endswith(".png") else page

		preview = self.make_preview()
		with (
			patch("raven.link_fetcher.safe_fetch", side_effect=fake_fetch),
			patch("raven.link_fetcher.IMAGE_PROBE_MAX_PIXELS", 100),
		):
			self.assertTrue(fill_preview(preview))

		# The preview still fetched; only the measurement was refused.
		self.assertEqual(preview.status, "Fetched")
		self.assertEqual(preview.image_width, 0)
		self.assertEqual(preview.image_height, 0)

	def test_failed_probe_still_fetches_the_preview(self):
		# The image being unreachable (or on a private IP) must not fail
		# the preview — the card just uses a fixed clipping box.
		page = SimpleNamespace(
			url="https://example.com/article",
			content_type="text/html",
			body=(
				b'<meta property="og:title" content="Hello"/>'
				b'<meta property="og:image" content="https://example.com/cover.png"/>'
			),
		)

		def fake_fetch(url, **_kwargs):
			if url.endswith(".png"):
				raise LinkFetchError("image gone")
			return page

		preview = self.make_preview()
		with patch("raven.link_fetcher.safe_fetch", side_effect=fake_fetch):
			self.assertTrue(fill_preview(preview))

		self.assertEqual(preview.status, "Fetched")
		self.assertEqual(preview.title, "Hello")
		self.assertEqual(preview.image_width, 0)
		self.assertEqual(preview.image_height, 0)

	def test_failures_retry_then_go_terminal(self):
		preview = self.make_preview()
		with patch("raven.link_fetcher.safe_fetch", side_effect=LinkFetchError("boom")):
			self.assertFalse(fill_preview(preview))
			# One failure is not terminal. The next share retries.
			self.assertEqual(preview.status, "Pending")
			self.assertTrue(_needs_fetch(preview))

			for _attempt in range(MAX_FETCH_ATTEMPTS - 1):
				fill_preview(preview)

		self.assertEqual(preview.status, "Failed")
		self.assertEqual(preview.fetch_attempts, MAX_FETCH_ATTEMPTS)
		self.assertFalse(_needs_fetch(preview))

	def test_blocked_is_terminal_immediately(self):
		preview = self.make_preview()
		with patch("raven.link_fetcher.safe_fetch", side_effect=BlockedURLError("non-public address")):
			self.assertFalse(fill_preview(preview))

		self.assertEqual(preview.status, "Blocked")
		self.assertFalse(_needs_fetch(preview))
