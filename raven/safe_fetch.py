# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

"""
A hardened HTTP fetcher for link previews.

The caller (see raven/link_fetcher.py) only passes URLs the server
extracted from saved message HTML. This module still treats every one of
them as hostile:

- only http and https
- DNS is resolved first, and every resolved IP must be public. Private,
  loopback, link-local, metadata and reserved ranges are all rejected.
- the connection goes to the resolved IP, not the hostname. A DNS record
  that changes between check and connect (rebinding) buys nothing.
- every redirect hop runs through the same checks, with a hop cap
- the body is streamed with a hard size cap
- the content type must be on the caller's allowlist
- no cookies, no proxy env vars, fixed user agent, strict timeouts

This module has no frappe imports on purpose. It is plain transport, and
that keeps it easy to test.
"""

import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit

import requests
from requests.adapters import HTTPAdapter

USER_AGENT = "Mozilla/5.0 (compatible; RavenBot/1.0; link previews)"
MAX_BODY_BYTES = 2 * 1024 * 1024
MAX_REDIRECTS = 5
CONNECT_TIMEOUT = 5
READ_TIMEOUT = 15
REDIRECT_STATUSES = {301, 302, 303, 307, 308}


class LinkFetchError(Exception):
	"""The fetch failed. Trying again later may work."""


class BlockedURLError(LinkFetchError):
	"""The URL points somewhere we refuse to go. Never retry."""


@dataclass
class FetchedResponse:
	url: str  # the final URL, after any redirects
	content_type: str
	body: bytes


def safe_fetch(
	url: str,
	*,
	allowed_content_types: tuple[str, ...],
	max_bytes: int = MAX_BODY_BYTES,
	user_agent: str | None = None,
) -> FetchedResponse:
	"""
	GET a URL with all the guards above. Returns the final response, or
	raises BlockedURLError (never retry) / LinkFetchError (may retry).

	user_agent overrides the default UA for hosts that gate their meta
	tags on the client (see link_fetcher's X strategy). The security
	guards do not change with the UA.
	"""
	for _hop in range(MAX_REDIRECTS + 1):
		parts = urlsplit(url)
		scheme = parts.scheme.lower()
		if scheme not in ("http", "https"):
			raise BlockedURLError(f"Scheme {scheme or 'none'} is not allowed")

		host = parts.hostname
		if not host:
			raise BlockedURLError("URL has no host")

		port = parts.port or (443 if scheme == "https" else 80)
		ip = resolve_public_ip(host, port)

		# Ask for what we can parse. Some hosts content-negotiate (Vercel
		# answers bots with markdown) — a plain */* invites formats we
		# would only reject afterwards.
		accept = ", ".join(allowed_content_types) + ", */*;q=0.1"
		response = _send_once(url, ip, accept, user_agent or USER_AGENT)
		try:
			if response.status_code in REDIRECT_STATUSES:
				location = response.headers.get("Location")
				if not location:
					raise LinkFetchError("Redirect without a Location header")
				# The next loop pass re-runs every check on the new URL.
				url = urljoin(url, location)
				continue

			if response.status_code != 200:
				raise LinkFetchError(f"HTTP {response.status_code}")

			content_type = (response.headers.get("Content-Type") or "").split(";")[0].strip().lower()
			if not content_type.startswith(allowed_content_types):
				raise LinkFetchError(f"Content type {content_type or 'unknown'} is not allowed")

			return FetchedResponse(
				url=url, content_type=content_type, body=_read_capped(response, max_bytes)
			)
		finally:
			response.close()

	raise LinkFetchError("Too many redirects")


def resolve_public_ip(host: str, port: int) -> str:
	"""
	Resolve a hostname and return the IP to connect to. Every address the
	name resolves to must be public. One bad address rejects the whole
	host: an attacker controls their own DNS and can mix answers.
	"""
	try:
		infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
	except OSError as error:
		raise LinkFetchError(f"Could not resolve {host}") from error

	addresses = []
	for info in infos:
		ip_string = info[4][0]
		try:
			address = ipaddress.ip_address(ip_string)
		except ValueError as error:
			raise LinkFetchError(f"Bad address for {host}") from error
		# An IPv4 address smuggled inside IPv6 must be judged as IPv4.
		mapped = getattr(address, "ipv4_mapped", None)
		if mapped is not None:
			address = mapped
		# is_global is False for private, loopback, link-local, CGNAT,
		# metadata and reserved ranges.
		if not address.is_global:
			raise BlockedURLError(f"{host} resolves to a non-public address")
		addresses.append(ip_string)

	if not addresses:
		raise LinkFetchError(f"Could not resolve {host}")
	return addresses[0]


class _PinnedAdapter(HTTPAdapter):
	"""
	Sends the request to a pre-resolved IP while doing TLS for the real
	hostname. The URL handed to requests carries the IP, so no second DNS
	lookup can happen. server_hostname keeps SNI and the certificate check
	bound to the real hostname.
	"""

	def __init__(self, tls_hostname: str):
		# Set before super().__init__ — that call builds the pool manager.
		self._tls_hostname = tls_hostname
		super().__init__(max_retries=0)

	def init_poolmanager(self, connections, maxsize, block=False, **pool_kwargs):
		if self._tls_hostname:
			pool_kwargs["server_hostname"] = self._tls_hostname
			pool_kwargs["assert_hostname"] = self._tls_hostname
		super().init_poolmanager(connections, maxsize, block, **pool_kwargs)


def _send_once(
	url: str, ip: str, accept: str = "*/*", user_agent: str = USER_AGENT
) -> requests.Response:
	"""One request to one already-validated IP. Never follows redirects."""
	parts = urlsplit(url)

	netloc = f"[{ip}]" if ":" in ip else ip
	if parts.port:
		netloc = f"{netloc}:{parts.port}"
	ip_url = parts._replace(netloc=netloc).geturl()

	# The Host header must carry the real hostname, since the URL now
	# carries the IP.
	host_header = parts.hostname if not parts.port else f"{parts.hostname}:{parts.port}"

	session = requests.Session()
	# Ignore proxy environment variables. A proxy would connect on its own
	# and dodge the IP checks.
	session.trust_env = False
	adapter = _PinnedAdapter(parts.hostname if parts.scheme == "https" else "")
	session.mount("https://", adapter)
	session.mount("http://", adapter)

	try:
		return session.get(
			ip_url,
			headers={"Host": host_header, "User-Agent": user_agent, "Accept": accept},
			timeout=(CONNECT_TIMEOUT, READ_TIMEOUT),
			stream=True,
			allow_redirects=False,
		)
	except requests.RequestException as error:
		raise LinkFetchError(str(error)[:200]) from error


def _read_capped(response: requests.Response, max_bytes: int) -> bytes:
	"""Read the streamed body, refusing to go past the cap."""
	declared = response.headers.get("Content-Length")
	if declared and declared.isdigit() and int(declared) > max_bytes:
		raise LinkFetchError("Response too large")

	chunks = []
	read = 0
	for chunk in response.iter_content(chunk_size=64 * 1024):
		read += len(chunk)
		if read > max_bytes:
			raise LinkFetchError("Response too large")
		chunks.append(chunk)
	return b"".join(chunks)
