# Copyright (c) 2026, The Commit Company (Algocode Technologies Pvt. Ltd.) and contributors
# For license information, please see license.txt

"""
Server-side link handling for messages.

One rule keeps this safe: the server only works with URLs it extracted
itself from saved message HTML. The client never supplies a URL to fetch.
See apps/web/docs/link-previews-plan.md for the full plan.
"""

import re
from urllib.parse import parse_qs, parse_qsl, urlencode, urlsplit, urlunsplit

import frappe

# Query params that only track the click. Dropping them never changes the
# page the URL points to. utm_* params are matched by prefix separately.
TRACKING_PARAMS = {
	"fbclid",
	"gclid",
	"dclid",
	"msclkid",
	"mc_cid",
	"mc_eid",
	"igsh",
	"igshid",
	"si",
}

# Domain rules for provider detection. Checked in order, first match wins.
# A host matches when it equals the domain or is a subdomain of it. Keep
# specific hosts (music.youtube.com) above broader ones (youtube.com).
# Provider names must match the "Provider" select options on Raven Link
# Preview and Raven Message Links. Frappe rejects a select value that is
# not in the options. The domains mirror the client's matchers in
# LinkPreview.tsx. The client parses ids to build embeds. This list only
# classifies links for search.
PROVIDER_DOMAINS = [
	("YouTube Music", ("music.youtube.com",)),
	("YouTube", ("youtube.com", "youtu.be", "youtube-nocookie.com")),
	("Spotify", ("spotify.com",)),
	("Apple Music", ("music.apple.com",)),
	("Apple Podcasts", ("podcasts.apple.com",)),
	("SoundCloud", ("soundcloud.com",)),
	("Loom", ("loom.com",)),
	("Vimeo", ("vimeo.com",)),
	("Reddit", ("reddit.com", "redd.it")),
	("X", ("x.com", "twitter.com")),
	("GitHub", ("github.com",)),
	# news.ycombinator.com only. The main ycombinator.com site is a normal
	# website and stays with the OG scrape as Other.
	("Hacker News", ("news.ycombinator.com",)),
	("Figma", ("figma.com",)),
	("Wikipedia", ("wikipedia.org",)),
	("Google Meet", ("meet.google.com",)),
	("Zoom", ("zoom.us",)),
	# Subdomain matching means this also covers doc.frappe.io, docs.frappe.io etc.
	("Frappe", ("frappe.io",)),
]

# Length of the unique url column on Raven Link Preview. Longer URLs never
# get a preview doc. Truncating them would corrupt the join key.
MAX_PREVIEW_URL_LENGTH = 500

# Path planes on the SITE'S OWN host that belong to apps, not the public
# website. Links into these never get a fetched preview: they are
# authenticated surfaces (desk old and new, the API and file planes, SPA
# apps like CRM and Helpdesk), so an anonymous fetch could only ever
# preview a login page. Everything ELSE on the site host — the blog, docs,
# any published web page — is the public website: it falls through to the
# provider registry and previews like any external link (on frappe.io that
# lands on the Frappe provider). safe_fetch stays the SSRF boundary for
# those fetches — public-IP resolution, pinned connection, no session —
# not this host check.
SITE_APP_PATH_PREFIXES = (
	"/app",
	"/desk",
	"/api",
	"/private",
	"/files",
	"/assets",
	"/login",
	"/crm",
	"/helpdesk",
)


def _path_is_under(path: str, prefix: str) -> bool:
	"""True when `path` is `prefix` itself or nested inside it — never a
	sibling that merely shares the spelling ("/application" is not "/app")."""
	return path == prefix or path.startswith(prefix + "/")


# Videos Raven refuses to preview, ever. Currently one famous video —
# a rickroll should stay a surprise. The client skips its embed too
# (LinkPreview.tsx keeps the same list). Server-side, no preview doc is
# created and nothing is ever fetched for it.
NEVER_PREVIEW_VIDEO_IDS = {"dQw4w9WgXcQ"}


def normalize_url(url: str) -> str | None:
	"""
	Turn a URL into one canonical spelling. Every message that shares a
	link then shares one stored preview. Only http(s) URLs are normalized.
	Anything else (mailto, tel, garbage) returns None and never gets a
	preview.

	Kept deliberately conservative: lowercase the scheme and host, drop
	default ports, drop tracking params, drop the fragment. The path and
	the remaining query are not touched. Params like YouTube's ?v= carry
	meaning.
	"""
	if not url:
		return None

	try:
		parts = urlsplit(url.strip())
		host = (parts.hostname or "").lower().rstrip(".")
		port = parts.port  # raises ValueError when the port is not a number
	except ValueError:
		return None

	scheme = parts.scheme.lower()
	if scheme not in ("http", "https") or not host:
		return None

	# .hostname strips the brackets off IPv6 hosts. Put them back.
	if ":" in host:
		host = f"[{host}]"

	# The rebuilt netloc drops any user:pass@ part. We never store credentials.
	default_port = 80 if scheme == "http" else 443
	netloc = host if port in (None, default_port) else f"{host}:{port}"

	query = urlencode(
		[
			(key, value)
			for key, value in parse_qsl(parts.query, keep_blank_values=True)
			if not is_tracking_param(key)
		]
	)

	# Drop fragments. They are anchors within the same page, and a server
	# fetch never sees them. Keep "#/..." fragments. Those are hash-router
	# pages, not anchors.
	fragment = parts.fragment if parts.fragment.startswith("/") else ""

	return urlunsplit((scheme, netloc, parts.path or "/", query, fragment))


def is_tracking_param(key: str) -> bool:
	lowered = key.lower()
	return lowered.startswith("utm_") or lowered in TRACKING_PARAMS


def detect_provider(normalized_url: str | None) -> str:
	"""
	Classify a normalized URL into one of the Provider select options.
	Pure domain matching, no network. The stored provider is only used for
	search filtering. Rendering keeps the client's own matcher chain.
	Returns "" for URLs that did not normalize (mailto, tel).
	"""
	if not normalized_url:
		return ""

	parts = urlsplit(normalized_url)
	host = parts.hostname or ""
	if not host:
		return ""

	# Frappe Meet is self-hosted, so its hosts come from Raven Settings.
	if host in get_frappe_meet_hosts():
		return "Frappe Meet"

	# A link back to this site itself. Only the APP PLANES get the site
	# providers (and with them the no-fetch treatment): Raven's own pages,
	# then desk/API/file surfaces and SPA apps. The site's public website —
	# a blog post, a docs page — deliberately falls THROUGH to the provider
	# registry below, so a Raven prod hosted on frappe.io still previews
	# frappe.io blog posts. Paths are compared lowercased: Frappe routes are
	# lowercase, and a case-mangled app path falling through only costs a
	# junk login-page preview, never a leak (the fetch is anonymous).
	if host == get_site_host():
		path = parts.path.lower()
		if _path_is_under(path, "/raven"):
			return "Raven Link"
		if any(_path_is_under(path, prefix) for prefix in SITE_APP_PATH_PREFIXES):
			return "Site Document Link"

	for provider, domains in PROVIDER_DOMAINS:
		for domain in domains:
			if host == domain or host.endswith("." + domain):
				return provider

	return "Other"


def youtube_video_id(url: str) -> str | None:
	"""
	The video id from any YouTube video URL shape — watch?v=, youtu.be/,
	shorts/, live/, embed/, v/ — on youtube.com, youtu.be and
	youtube-nocookie.com (www/m/music subdomains). None for anything else.
	Mirrors the client's matchYouTube in LinkPreview.tsx.
	"""
	parts = urlsplit(url)
	host = re.sub(r"^(www|m|music)\.", "", (parts.hostname or "").lower())

	def valid(video_id):
		return video_id if video_id and re.fullmatch(r"[\w-]{6,}", video_id) else None

	if host == "youtu.be":
		segments = [segment for segment in parts.path.split("/") if segment]
		return valid(segments[0]) if segments else None

	if host in ("youtube.com", "youtube-nocookie.com"):
		if parts.path == "/watch":
			return valid(parse_qs(parts.query).get("v", [""])[0])
		match = re.match(r"^/(?:embed|shorts|live|v)/([\w-]+)", parts.path)
		return valid(match.group(1)) if match else None

	return None


def is_preview_blocked(normalized_url: str) -> bool:
	"""
	Links that must never get a preview: the one famous video, and
	anything on the admin's blocklist (Raven Settings → Blocked Links).
	Blocking is about the PREVIEW only — blocked links still get child
	rows and providers, so the Links search still finds them.
	"""
	if youtube_video_id(normalized_url) in NEVER_PREVIEW_VIDEO_IDS:
		return True

	domains, exact = get_preview_blocklist()
	if not domains and not exact:
		return False

	host = urlsplit(normalized_url).hostname or ""
	if any(host == domain or host.endswith("." + domain) for domain in domains):
		return True

	# Exact rows match the whole URL but IGNORE the scheme: autolinked
	# text ("frappe.io") and pasted links disagree about http vs https,
	# and a block that only works for one spelling reads as flaky.
	return _schemeless(normalized_url) in exact


def get_preview_blocklist() -> tuple[set[str], set[str]]:
	"""
	The admin's blocklist, parsed. Two kinds of rows:
	- match_exact unchecked (the default): block the whole domain,
	  subdomains included. Returned in the first set, as hostnames.
	- match_exact checked: block just that URL — "frappe.io" without
	  killing the frappe.io/blog cards. Returned in the second set, as
	  normalized scheme-less URLs.
	"""
	settings = frappe.get_cached_doc("Raven Settings")
	domains: set[str] = set()
	exact: set[str] = set()

	for row in settings.blocked_links or []:
		entry = (row.link or "").strip()
		if not entry:
			continue
		with_scheme = entry if "://" in entry else f"https://{entry}"
		if row.match_exact:
			key = _schemeless(normalize_url(with_scheme) or "")
			if key:
				exact.add(key)
		else:
			hostname = urlsplit(with_scheme).hostname
			if hostname:
				domains.add(hostname.lower())

	return domains, exact


def _schemeless(url: str) -> str:
	return url.split("://", 1)[-1] if url else ""


def get_site_host() -> str:
	# Not frappe.utils.get_host_name(): that keeps the port (a dev bench
	# returns "site:8000"). urlsplit's .hostname strips the port and
	# lowercases in one step, matching how link hosts are parsed above.
	return (urlsplit(frappe.utils.get_url()).hostname or "").lower()


def get_frappe_meet_hosts() -> set[str]:
	"""Hosts from Raven Settings, one per line. Bare hostnames or full URLs."""
	raw = frappe.get_single_value("Raven Settings", "frappe_meet_hosted_urls") or ""
	hosts = set()
	for line in raw.split("\n"):
		line = line.strip()
		if not line:
			continue
		if "://" not in line:
			line = f"https://{line}"
		host = urlsplit(line).hostname
		if host:
			hosts.add(host.lower())
	return hosts


def process_message_links(message_id: str):
	"""
	Background job that runs after a message with links is saved. For each
	normalized URL it makes sure one Raven Link Preview doc exists, fetches
	content for the ones that still need it, and tells the channel about
	newly fetched previews. In tests only the shells are created — no
	network.
	"""
	from raven.link_fetcher import SKIP_PREVIEW_PROVIDERS, fill_preview

	rows = frappe.get_all(
		"Raven Message Links",
		filters={"parent": message_id, "parenttype": "Raven Message"},
		fields=["normalized_url", "provider"],
	)

	seen = set()
	fetched = []
	for row in rows:
		url = row.normalized_url
		if not url or url in seen or len(url) > MAX_PREVIEW_URL_LENGTH:
			continue
		if row.provider in SKIP_PREVIEW_PROVIDERS:
			continue
		if is_preview_blocked(url):
			continue
		seen.add(url)

		preview_name = frappe.db.get_value("Raven Link Preview", {"url": url})
		if preview_name:
			preview = frappe.get_doc("Raven Link Preview", preview_name)
		else:
			preview = frappe.new_doc("Raven Link Preview")
			preview.url = url
			preview.provider = row.provider or "Other"
			preview.status = "Pending"
			try:
				preview.insert(ignore_permissions=True)
			except (frappe.DuplicateEntryError, frappe.UniqueValidationError):
				# Another job inserted the same URL first. Use theirs.
				preview = frappe.get_doc("Raven Link Preview", {"url": url})

		if frappe.flags.in_test or not _needs_fetch(preview):
			continue

		if fill_preview(preview):
			fetched.append(preview)
		# Keep whatever happened, even if a later URL crashes the job.
		frappe.db.commit()

	if fetched:
		_publish_fetched_previews(message_id, fetched)


def _needs_fetch(preview) -> bool:
	if preview.status == "Pending":
		return True
	if preview.status == "Fetched":
		# A stale preview is refetched when its link gets shared again.
		# The full refresh policy is Phase 4.
		return bool(preview.stale_after) and frappe.utils.now_datetime() > frappe.utils.get_datetime(
			preview.stale_after
		)
	# Failed and Blocked are terminal.
	return False


def _publish_fetched_previews(message_id: str, previews: list):
	"""
	Tell the channel that previews just landed, payload included, so
	clients can patch their store without refetching. The message may have
	been deleted while we fetched — then there is nobody to tell.
	"""
	channel_id = frappe.db.get_value("Raven Message", message_id, "channel_id")
	if not channel_id:
		return

	frappe.publish_realtime(
		"link_previews_updated",
		{
			"channel_id": channel_id,
			"previews": [
				{
					"url": preview.url,
					"provider": preview.provider,
					"title": preview.title,
					"description": preview.description,
					"image": preview.image,
					"site_name": preview.site_name,
					"image_width": preview.image_width,
					"image_height": preview.image_height,
					"metadata": preview.metadata,
				}
				for preview in previews
			],
		},
		doctype="Raven Channel",
		docname=channel_id,
	)
