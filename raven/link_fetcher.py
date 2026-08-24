# Copyright (c) 2026, The Commit Company (Algocode Technologies Pvt. Ltd.) and contributors
# For license information, please see license.txt

"""
Fills a Raven Link Preview doc with content.

Strategy per provider: keyless oEmbed endpoints where they exist (JSON,
far more reliable than scraping past bot walls), Wikipedia's REST summary
API, and an Open Graph scrape of the page itself for everything else.
Every request goes through safe_fetch. Only the background job in
raven/links.py calls this — never a request handler.
"""

import json
import re
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlencode, urljoin, urlsplit

import frappe
from bs4 import BeautifulSoup

from raven.safe_fetch import BlockedURLError, LinkFetchError, safe_fetch

# One failed fetch does not condemn a link. After this many failures the
# preview is marked Failed and never tried again.
MAX_FETCH_ATTEMPTS = 3

# How long a fetched preview stays fresh. A stale preview is refetched
# the next time someone shares its link. The full refresh policy is
# Phase 4 of the plan.
STALE_AFTER_DAYS = 30

# Providers whose links the client renders entirely on its own (meeting
# cards, Raven's internal cards). They never need a preview doc. Fetching
# them would also be wrong: on a dev bench the site's own host resolves
# to a loopback address, which safe_fetch rightly refuses.
SKIP_PREVIEW_PROVIDERS = {
	"Raven Link",
	"Site Document Link",
	"Frappe Meet",
	"Google Meet",
	"Zoom",
}

JSON_TYPES = ("application/json", "text/json", "text/javascript")
HTML_TYPES = ("text/html", "application/xhtml+xml")
MARKDOWN_TYPES = ("text/markdown",)

# Keyless oEmbed endpoints. Each takes the page URL as a query param and
# answers JSON.
OEMBED_ENDPOINTS = {
	"YouTube": "https://www.youtube.com/oembed",
	"YouTube Music": "https://www.youtube.com/oembed",
	"X": "https://publish.twitter.com/oembed",
	"Reddit": "https://www.reddit.com/oembed",
	"Vimeo": "https://vimeo.com/api/oembed.json",
	"Loom": "https://www.loom.com/v1/oembed",
	"SoundCloud": "https://soundcloud.com/oembed",
	"Spotify": "https://open.spotify.com/oembed",
}


def fill_preview(preview) -> bool:
	"""
	Fetch content for one Raven Link Preview doc and save the outcome.
	Returns True when the fetch succeeded. Never raises: failures land in
	the doc's status and fetch_error fields.
	"""
	fetched = False
	try:
		data = fetch_preview_data(preview.url, preview.provider)
	except BlockedURLError as error:
		preview.status = "Blocked"
		preview.fetch_error = str(error)[:400]
	except LinkFetchError as error:
		_record_failure(preview, str(error)[:400])
	except Exception:
		# A parser bug must not kill the rest of the job's URLs.
		frappe.log_error(f"Link preview fetch crashed for {preview.url}")
		_record_failure(preview, "Unexpected error while fetching")
	else:
		_measure_image_if_needed(data)
		_apply(preview, data)
		fetched = True

	preview.save(ignore_permissions=True)
	return fetched


def _record_failure(preview, error: str):
	preview.fetch_attempts = (preview.fetch_attempts or 0) + 1
	# Pending previews get retried the next time the link is shared.
	preview.status = "Failed" if preview.fetch_attempts >= MAX_FETCH_ATTEMPTS else "Pending"
	preview.fetch_error = error


# Image probe limits. 2MB covers almost every og banner; anything bigger
# just skips the probe and the client uses a fixed box instead.
IMAGE_CONTENT_TYPES = ("image/",)
IMAGE_PROBE_MAX_BYTES = 2 * 1024 * 1024

# Decompression-bomb guard. A small file can decode to a huge canvas, and
# exif_transpose decodes pixels when the image carries a rotation tag. 25M
# pixels is ~4x a 4K frame — far past any real og image. PIL's own guard
# only kicks in around 180M pixels, which is already a ~270MB allocation.
IMAGE_PROBE_MAX_PIXELS = 25_000_000


def _measure_image_if_needed(data: dict):
	"""
	Fill in image_width and image_height by downloading the image and
	measuring it — but only when the page did not declare them.
	og:image:width is optional, and big sites (frappe.io included) omit it.

	Why: the card reserves the image's box from these numbers BEFORE the
	image loads. Without them, the card changes shape when the image
	arrives — the last of Phase 5's scroll-shift sources
	(docs/link-previews-plan.md).

	The image URL came out of a page we just fetched, so it is as hostile
	as any URL. safe_fetch applies the same SSRF guards it applies to the
	page itself. Best effort, one attempt: any failure leaves the
	dimensions empty and the client falls back to a fixed clipping box.
	"""
	image_url = data.get("image") or ""
	if not image_url:
		return
	if data.get("image_width") and data.get("image_height"):
		return
	# _apply drops image URLs longer than the column — don't probe those.
	if len(image_url) > 500:
		return

	try:
		response = safe_fetch(
			image_url,
			allowed_content_types=IMAGE_CONTENT_TYPES,
			max_bytes=IMAGE_PROBE_MAX_BYTES,
		)
	except LinkFetchError:
		return

	try:
		import io

		from PIL import Image, ImageOps

		image = Image.open(io.BytesIO(response.body))
		# Reading .size only parses headers — no pixels decoded yet. Check
		# the canvas size BEFORE exif_transpose, which does decode.
		width, height = image.size
		if width * height > IMAGE_PROBE_MAX_PIXELS:
			return
		# Honour EXIF rotation, like the message-image upload path does:
		# the reserved box must match what the browser will display.
		image = ImageOps.exif_transpose(image)
		width, height = image.size
	except Exception:
		return

	if width and height:
		data["image_width"] = width
		data["image_height"] = height


def _apply(preview, data: dict):
	preview.title = (data.get("title") or "")[:400]
	preview.description = (data.get("description") or "")[:1000]
	preview.site_name = (data.get("site_name") or "")[:400]

	# The image column caps at 500 chars. A longer URL can't be truncated
	# without breaking it, so drop it.
	image = data.get("image") or ""
	preview.image = image if len(image) <= 500 else ""

	preview.image_width = data.get("image_width") or 0
	preview.image_height = data.get("image_height") or 0
	preview.metadata = data.get("metadata") or None

	preview.status = "Fetched"
	preview.fetch_error = ""
	preview.fetched_on = frappe.utils.now_datetime()
	preview.stale_after = frappe.utils.add_days(preview.fetched_on, STALE_AFTER_DAYS)


def fetch_preview_data(url: str, provider: str) -> dict:
	"""Route to the right strategy. Raises LinkFetchError / BlockedURLError."""
	if provider == "X":
		return fetch_x(url)

	endpoint = OEMBED_ENDPOINTS.get(provider)
	if endpoint:
		return fetch_oembed(endpoint, url)

	if provider == "Wikipedia":
		data = fetch_wikipedia_summary(url)
		if data is not None:
			return data

	if provider == "Hacker News":
		data = fetch_hacker_news(url)
		if data is not None:
			return data

	return fetch_open_graph(url)


def fetch_oembed(endpoint: str, url: str) -> dict:
	query = urlencode({"url": url, "format": "json"})
	response = safe_fetch(f"{endpoint}?{query}", allowed_content_types=JSON_TYPES)
	payload = _parse_json(response.body)

	title = payload.get("title") or ""
	description = ""
	# X answers with the tweet as an HTML blockquote and no title. The
	# tweet's text lives in the blockquote's <p>; the rest of the
	# blockquote is an attribution tail ("— Author (@handle) date") that
	# the title already covers. <br> tags become real newlines so the
	# tweet keeps its line breaks (the client renders them for X).
	if not title and payload.get("html"):
		title = payload.get("author_name") or ""
		soup = BeautifulSoup(payload["html"], "html.parser")
		tweet_text = soup.find("p")
		if tweet_text:
			for br in tweet_text.find_all("br"):
				br.replace_with("\n")
			description = tweet_text.get_text().strip()
		else:
			description = soup.get_text(" ", strip=True)

	return {
		"title": title or payload.get("author_name") or "",
		"description": description,
		"image": payload.get("thumbnail_url") or "",
		"site_name": payload.get("provider_name") or "",
		"image_width": payload.get("thumbnail_width"),
		"image_height": payload.get("thumbnail_height"),
	}


# X only serves meta tags to clients that look like link-preview
# crawlers — the exact UA family v2 used, and what iMessage and Slack
# present as. Used ONLY by the X strategy below.
PREVIEW_BOT_USER_AGENT = (
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 "
	"(KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 "
	"facebookexternalhit/1.1 Facebot Twitterbot/1.0"
)


def fetch_x(url: str) -> dict:
	"""
	Two calls for X. The official oEmbed gives the reliable part — author
	and tweet text — but carries NO image fields at all (it hands out
	embed HTML, not metadata). The tweet PAGE carries og:image, gated on a
	preview-crawler UA. The scrape is best effort: when X stops honoring
	the UA, the card keeps its text and simply has no image.
	"""
	data = fetch_oembed(OEMBED_ENDPOINTS["X"], url)

	try:
		page = safe_fetch(url, allowed_content_types=HTML_TYPES, user_agent=PREVIEW_BOT_USER_AGENT)
		scraped = parse_open_graph(page.body, page.url)
	except LinkFetchError:
		return data

	# A tweet with NO media serves the author's avatar as its og:image
	# (under /profile_images/). A giant profile picture is worse than no
	# image — keep only real tweet media (photos and video thumbnails live
	# under /media/ and */video_thumb/ paths).
	if scraped.get("image") and "/profile_images/" not in scraped["image"]:
		data["image"] = scraped["image"]
		data["image_width"] = scraped.get("image_width")
		data["image_height"] = scraped.get("image_height")

	return data


def fetch_wikipedia_summary(url: str) -> dict | None:
	"""
	Wikipedia's REST summary API. Works for /wiki/<Title> URLs. Returns
	None for other Wikipedia paths, and the caller falls back to a page
	scrape. The API host comes from the link itself, so language editions
	(en., de., hi.) just work.
	"""
	parts = urlsplit(url)
	prefix = "/wiki/"
	if not parts.path.startswith(prefix):
		return None
	title = parts.path[len(prefix) :]
	if not title or "/" in title:
		return None

	endpoint = f"https://{parts.hostname}/api/rest_v1/page/summary/{title}"
	response = safe_fetch(endpoint, allowed_content_types=JSON_TYPES)
	payload = _parse_json(response.body)
	thumbnail = payload.get("thumbnail") or {}

	return {
		"title": payload.get("title") or "",
		"description": payload.get("extract") or "",
		"image": thumbnail.get("source") or "",
		"site_name": "Wikipedia",
		"image_width": thumbnail.get("width"),
		"image_height": thumbnail.get("height"),
	}


def fetch_hacker_news(url: str) -> dict | None:
	"""
	HN pages carry almost no OG metadata, but the official Firebase API
	returns a compact JSON per item. Works for /item?id=N links (stories
	and comments). Returns None for other HN pages (front page, user
	pages) — the caller falls back to a page scrape.
	"""
	parts = urlsplit(url)
	item_id = parse_qs(parts.query).get("id", [""])[0]
	if parts.path != "/item" or not item_id.isdigit():
		return None

	response = safe_fetch(
		f"https://hacker-news.firebaseio.com/v0/item/{item_id}.json",
		allowed_content_types=JSON_TYPES,
	)
	# A dead or unknown id answers with JSON null — _parse_json turns that
	# into a LinkFetchError and the normal retry path takes over.
	payload = _parse_json(response.body)

	author = payload.get("by") or ""
	title = payload.get("title") or ""
	if not title:
		# Comments have no title, just their text.
		title = f"Comment by {author}" if author else "Hacker News comment"

	# Ask HN / text posts and comments carry HTML in `text`.
	description = ""
	if payload.get("text"):
		description = BeautifulSoup(payload["text"], "html.parser").get_text(" ", strip=True)

	metadata = {}
	if author:
		metadata["author"] = author
	if isinstance(payload.get("time"), int):
		metadata["published_on"] = datetime.fromtimestamp(payload["time"], tz=timezone.utc).strftime(
			"%Y-%m-%d"
		)
	if isinstance(payload.get("score"), int):
		metadata["points"] = payload["score"]
	if isinstance(payload.get("descendants"), int):
		metadata["comments"] = payload["descendants"]

	return {
		"title": title,
		"description": description,
		"image": "",
		"site_name": "Hacker News",
		"image_width": None,
		"image_height": None,
		"metadata": metadata,
	}


def fetch_open_graph(url: str) -> dict:
	"""The fallback for providers without a structured API."""
	# text/markdown is a real answer in the wild: Vercel serves bots a
	# markdown rendition of the page. We ask for HTML first (safe_fetch
	# builds the Accept header from this list, in order), and parse
	# markdown when that is all the host will give us.
	response = safe_fetch(url, allowed_content_types=HTML_TYPES + MARKDOWN_TYPES)
	if response.content_type.startswith(MARKDOWN_TYPES):
		return parse_markdown_preview(response.body, url)
	return parse_open_graph(response.body, response.url)


def parse_open_graph(html: bytes | str, base_url: str) -> dict:
	"""Pull OG / twitter-card / plain meta tags out of a page."""
	soup = BeautifulSoup(html, "html.parser")

	def meta(*names) -> str:
		for name in names:
			tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
			content = tag.get("content") if tag else None
			if content:
				return content.strip()
		return ""

	title = meta("og:title", "twitter:title")
	if not title and soup.title and soup.title.string:
		title = soup.title.string.strip()

	# Plain name="image" is the same informal fallback the description
	# chain already uses — some blogs (frappe.io custom pages included)
	# declare only that.
	image = meta("og:image", "twitter:image", "image")
	if image:
		from requests.utils import requote_uri

		# Percent-encode what the page left raw (spaces in filenames are
		# common). requote_uri leaves already-encoded parts alone, so a
		# clean URL passes through unchanged. Needed for the dimension
		# probe's fetch to be a valid request; browsers are forgiving,
		# servers less so.
		image = requote_uri(urljoin(base_url, image))

	def as_int(value: str):
		return int(value) if value.isdigit() else None

	return {
		"title": title,
		"description": meta("og:description", "twitter:description", "description"),
		"image": image,
		"site_name": meta("og:site_name") or (urlsplit(base_url).hostname or ""),
		"image_width": as_int(meta("og:image:width")),
		"image_height": as_int(meta("og:image:height")),
		"metadata": extract_json_ld(soup),
	}


# The JSON-LD keys worth keeping. Pages put arbitrary data in these
# blocks (some inline whole product catalogs), so nothing outside this
# set survives, and every kept value is a capped plain string.
MAX_JSON_LD_BYTES = 100_000
MAX_JSON_LD_VALUE_LENGTH = 200


def extract_json_ld(soup) -> dict:
	"""
	Pull the useful bits of schema.org JSON-LD — the structured data blogs
	and articles embed (author, publish date, publisher). Returns a small
	flat dict, or {} when the page has nothing usable.
	"""
	for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
		# get_text, not .string — .string is None when the tag holds more
		# than one text node.
		raw = script.get_text()
		if not raw or len(raw) > MAX_JSON_LD_BYTES:
			continue
		try:
			payload = json.loads(raw)
		except ValueError:
			continue
		for node in _json_ld_nodes(payload):
			data = _pick_json_ld_fields(node)
			if data:
				return data
	return {}


def _json_ld_nodes(payload):
	"""A block can be one node, a list of nodes, or a @graph of nodes."""
	if isinstance(payload, list):
		nodes = payload
	elif isinstance(payload, dict):
		graph = payload.get("@graph")
		nodes = [payload] + (graph if isinstance(graph, list) else [])
	else:
		return
	for node in nodes:
		if isinstance(node, dict):
			yield node


def _pick_json_ld_fields(node: dict) -> dict:
	"""Keep whitelisted fields only. A node with no author and no date is
	not worth storing."""
	picked = {}

	node_type = node.get("@type")
	# "@type": ["Article", "NewsArticle"] is a common spelling.
	if isinstance(node_type, list):
		node_type = next((item for item in node_type if isinstance(item, str)), None)
	if isinstance(node_type, str):
		picked["type"] = node_type[:MAX_JSON_LD_VALUE_LENGTH]

	author = _json_ld_name(node.get("author"))
	if author:
		picked["author"] = author

	published = node.get("datePublished")
	if isinstance(published, str) and published:
		picked["published_on"] = published[:MAX_JSON_LD_VALUE_LENGTH]

	publisher = _json_ld_name(node.get("publisher"))
	if publisher:
		picked["publisher"] = publisher

	if "author" in picked or "published_on" in picked:
		return picked
	return {}


def _json_ld_name(value) -> str:
	"""author / publisher can be a string, an object, or a list of either."""
	if isinstance(value, str):
		return value.strip()[:MAX_JSON_LD_VALUE_LENGTH]
	if isinstance(value, dict):
		name = value.get("name")
		return name.strip()[:MAX_JSON_LD_VALUE_LENGTH] if isinstance(name, str) else ""
	if isinstance(value, list):
		names = [name for name in (_json_ld_name(item) for item in value) if name]
		return ", ".join(names)[:MAX_JSON_LD_VALUE_LENGTH]
	return ""


def parse_markdown_preview(body: bytes, url: str) -> dict:
	"""
	Markdown has no meta tags. Take the title from frontmatter or the
	first heading, and the description from the first paragraph after it.
	"""
	text = body.decode("utf-8", errors="replace")
	lines = text.split("\n")

	title = ""
	body_start = 0
	# Frontmatter block: --- ... title: ... --- . The body scan below must
	# start after it, or its closing --- would read as content.
	if lines and lines[0].strip() == "---":
		for index, line in enumerate(lines[1:50], start=1):
			if line.strip() == "---":
				body_start = index + 1
				break
			if not title and line.lower().startswith("title:"):
				title = line.split(":", 1)[1].strip().strip("\"'")

	description = ""
	for line in lines[body_start:]:
		stripped = line.strip()
		if not stripped:
			continue
		if stripped.startswith("#"):
			if not title:
				title = stripped.lstrip("#").strip()
			continue
		if title:
			# Horizontal rules are not content.
			if stripped in ("---", "***", "___"):
				continue
			cleaned = _strip_markdown_syntax(stripped)
			# An image-only line strips to nothing. Keep looking.
			if cleaned:
				description = cleaned
				break

	return {
		"title": title,
		"description": description,
		"image": "",
		"site_name": urlsplit(url).hostname or "",
		"image_width": None,
		"image_height": None,
		"metadata": {},
	}


def _strip_markdown_syntax(line: str) -> str:
	"""Drop images, unwrap links, drop emphasis marks. Good enough for a
	one-line teaser."""
	line = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", line)  # images
	line = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", line)  # links -> their text
	return line.replace("**", "").replace("*", "").replace("`", "").strip()


def _parse_json(body: bytes) -> dict:
	try:
		payload = json.loads(body)
	except ValueError as error:
		raise LinkFetchError("Response was not valid JSON") from error
	if not isinstance(payload, dict):
		raise LinkFetchError("Response was not a JSON object")
	return payload
