import frappe
from frappe.tests import IntegrationTestCase

from raven.links import (
	detect_provider,
	is_preview_blocked,
	normalize_url,
	process_message_links,
	youtube_video_id,
)


class TestPreviewBlocklist(IntegrationTestCase):
	def set_blocklist(self, rows):
		"""
		Write blocklist rows to Raven Settings. Saving clears the cached
		doc, which is what is_preview_blocked reads. addCleanup restores —
		the class-level rollback alone would leave a stale settings doc in
		the document cache for later test classes.
		"""
		settings = frappe.get_doc("Raven Settings")
		settings.blocked_links = []
		for link, match_exact in rows:
			settings.append("blocked_links", {"link": link, "match_exact": match_exact})
		settings.save(ignore_permissions=True)
		self.addCleanup(self.clear_blocklist)

	def clear_blocklist(self):
		settings = frappe.get_doc("Raven Settings")
		settings.blocked_links = []
		settings.save(ignore_permissions=True)

	def test_domain_rows_block_the_whole_domain(self):
		self.set_blocklist([("frappe.io", 0)])
		self.assertTrue(is_preview_blocked(normalize_url("https://frappe.io/")))
		self.assertTrue(is_preview_blocked(normalize_url("https://frappe.io/blog/xyz")))
		self.assertTrue(is_preview_blocked(normalize_url("https://docs.frappe.io/framework")))
		# A lookalike domain is not a subdomain.
		self.assertFalse(is_preview_blocked(normalize_url("https://notfrappe.io/")))

	def test_exact_rows_block_one_url_in_any_spelling(self):
		self.set_blocklist([("frappe.io", 1)])
		# Every spelling of the homepage is blocked: scheme, trailing
		# slash and tracking params all normalize away.
		self.assertTrue(is_preview_blocked(normalize_url("https://frappe.io")))
		self.assertTrue(is_preview_blocked(normalize_url("http://frappe.io/")))
		self.assertTrue(is_preview_blocked(normalize_url("https://frappe.io/?utm_source=x")))
		# Deeper paths keep their previews — that is the point.
		self.assertFalse(is_preview_blocked(normalize_url("https://frappe.io/blog/xyz")))

	def test_get_previews_hides_stored_docs_for_blocked_urls(self):
		from raven.api.preview_links import get_previews

		url = f"https://blocked-{frappe.generate_hash(length=8)}.example.com/page"
		normalized = normalize_url(url)
		preview = frappe.new_doc("Raven Link Preview")
		preview.url = normalized
		preview.provider = "Other"
		preview.status = "Fetched"
		preview.title = "Stored before the block"
		preview.insert(ignore_permissions=True)

		# Visible before the block, gone after — the doc predates the
		# block and must not leak through reads.
		self.assertIsNotNone(get_previews([url])[url])
		self.set_blocklist([(normalized, 1)])
		self.assertIsNone(get_previews([url])[url])


EXTRA_TEST_RECORD_DEPENDENCIES = ["User", "Raven User"]


class TestLinkNormalization(IntegrationTestCase):
	def test_normalize_url(self):
		# Scheme and host lowercase, default port dropped, path case kept.
		self.assertEqual(normalize_url("HTTPS://Example.COM:443/Path"), "https://example.com/Path")
		# Non-default ports survive.
		self.assertEqual(normalize_url("http://example.com:8080/x"), "http://example.com:8080/x")
		# Tracking params dropped, load-bearing params kept.
		self.assertEqual(
			normalize_url("https://www.youtube.com/watch?v=abc123&utm_source=share&si=junk"),
			"https://www.youtube.com/watch?v=abc123",
		)
		# Fragments are dropped, except hash-router pages.
		self.assertEqual(normalize_url("https://example.com/page#section"), "https://example.com/page")
		self.assertEqual(
			normalize_url("https://example.com/app#/inbox"), "https://example.com/app#/inbox"
		)
		# A bare host gets the root path, so both spellings share one row.
		self.assertEqual(normalize_url("https://example.com"), "https://example.com/")
		# Credentials are never stored.
		self.assertEqual(normalize_url("https://user:pass@example.com/x"), "https://example.com/x")
		# Only http(s) normalizes.
		self.assertIsNone(normalize_url("mailto:someone@example.com"))
		self.assertIsNone(normalize_url("tel:+911234567890"))
		self.assertIsNone(normalize_url("javascript:alert(1)"))
		self.assertIsNone(normalize_url("http://"))
		self.assertIsNone(normalize_url(""))

	def test_detect_provider(self):
		cases = {
			"https://www.youtube.com/watch?v=abc": "YouTube",
			"https://youtu.be/abc": "YouTube",
			"https://music.youtube.com/watch?v=abc": "YouTube Music",
			"https://open.spotify.com/track/xyz": "Spotify",
			"https://en.wikipedia.org/wiki/Frappe": "Wikipedia",
			"https://github.com/frappe/frappe": "GitHub",
			"https://x.com/frappetech/status/1": "X",
			"https://twitter.com/frappetech/status/1": "X",
			"https://old.reddit.com/r/foo/comments/1/bar/": "Reddit",
			"https://meet.google.com/abc-defg-hij": "Google Meet",
			"https://company.zoom.us/j/1234567890": "Zoom",
			"https://frappe.io/blog": "Frappe",
			"https://docs.frappe.io/framework": "Frappe",
			"https://news.ycombinator.com/item?id=1": "Hacker News",
			"https://www.ycombinator.com/companies": "Other",
			"https://some-random-blog.dev/post": "Other",
		}
		for url, provider in cases.items():
			self.assertEqual(detect_provider(normalize_url(url)), provider, url)
		# Links that never normalize carry no provider.
		self.assertEqual(detect_provider(normalize_url("mailto:x@y.com")), "")

	def test_youtube_video_id(self):
		cases = {
			"https://www.youtube.com/watch?v=abc123": "abc123",
			"https://youtu.be/abc123": "abc123",
			"https://youtube.com/shorts/abc123": "abc123",
			"https://music.youtube.com/watch?v=abc123": "abc123",
			"https://www.youtube.com/playlist?list=xyz": None,
			"https://example.com/watch?v=abc123": None,
		}
		for url, video_id in cases.items():
			self.assertEqual(youtube_video_id(url), video_id, url)

	def test_the_one_video_that_never_gets_a_preview(self):
		for url in (
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			"https://youtu.be/dQw4w9WgXcQ",
			"https://youtube.com/shorts/dQw4w9WgXcQ",
		):
			self.assertTrue(is_preview_blocked(normalize_url(url)), url)
		self.assertFalse(is_preview_blocked("https://www.youtube.com/watch?v=abc123"))

	def test_links_to_this_site(self):
		site = frappe.utils.get_url()

		# Raven's own pages get their own provider.
		self.assertEqual(detect_provider(normalize_url(site + "/raven/channel/general")), "Raven Link")

		# App planes on this site are document links — desk (new and old),
		# the API/file planes, and SPA apps.
		for path in (
			"/app/note/some-note",
			"/desk/note/some-note",
			"/api/method/frappe.ping",
			"/private/files/secret.pdf",
			"/crm/leads/CRM-LEAD-0001",
			"/helpdesk/tickets/1",
		):
			self.assertEqual(detect_provider(normalize_url(site + path)), "Site Document Link", path)

		# The site's public WEBSITE falls through to the provider registry —
		# a Raven prod hosted on frappe.io must still preview frappe.io blog
		# posts. On the test site the registry matches nothing, so these read
		# as any external website would.
		for path in ("/blog/some-post", "/", "/apps"):
			provider = detect_provider(normalize_url(site + path))
			self.assertNotIn(provider, ("Raven Link", "Site Document Link"), path)

		# Prefix match, not substring: a website page that merely shares the
		# spelling of an app plane is still the website.
		self.assertNotEqual(
			detect_provider(normalize_url(site + "/application-process")), "Site Document Link"
		)


class TestMessageLinkRows(IntegrationTestCase):
	# The workspace and channel are created ONCE for the class, not per
	# test. Frappe only rolls back when the whole class finishes, so all
	# test methods share one transaction — a per-test setUp would insert
	# the same workspace name twice and hit the primary key. The hash
	# suffix guards against leftovers from a hard-crashed earlier run.
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		frappe.get_doc("User", "test@example.com").add_roles("Raven User")
		frappe.set_user("test@example.com")

		suffix = frappe.generate_hash(length=8)
		cls.workspace = frappe.get_doc(
			{
				"doctype": "Raven Workspace",
				"workspace_name": f"Links Test Workspace {suffix}",
				"type": "Public",
			}
		).insert()

		cls.channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": f"links-test-channel-{suffix}",
				"type": "Private",
				"workspace": cls.workspace.name,
			}
		).insert()

	def setUp(self):
		super().setUp()
		frappe.set_user("test@example.com")

	def make_message(self, text: str):
		return frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": self.channel.name,
				"message_type": "Text",
				"text": text,
			}
		).insert()

	def test_link_rows_are_normalized_and_classified(self):
		message = self.make_message(
			'<p>watch <a href="https://www.YouTube.com/watch?v=abc123&utm_source=share">this</a>'
			' or write to <a href="mailto:x@y.com">me</a></p>'
		)

		self.assertEqual(len(message.links_table), 2)

		row = message.links_table[0]
		# The raw spelling is preserved. get_messages ships this untouched.
		self.assertEqual(row.url, "https://www.YouTube.com/watch?v=abc123&utm_source=share")
		self.assertEqual(row.normalized_url, "https://www.youtube.com/watch?v=abc123")
		self.assertEqual(row.provider, "YouTube")

		# mailto never normalizes and carries no provider.
		mail_row = message.links_table[1]
		self.assertFalse(mail_row.normalized_url)
		self.assertFalse(mail_row.provider)

	def test_edit_replaces_rows_instead_of_duplicating(self):
		message = self.make_message('<p><a href="https://github.com/frappe/frappe">repo</a></p>')
		self.assertEqual(len(message.links_table), 1)

		message.text = '<p><a href="https://vimeo.com/12345">video</a></p>'
		message.save()
		message.reload()

		self.assertEqual(len(message.links_table), 1)
		self.assertEqual(message.links_table[0].provider, "Vimeo")

	def test_blocked_video_never_gets_a_preview_doc(self):
		message = self.make_message(
			'<p><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">a totally normal link</a></p>'
		)
		process_message_links(message.name)
		self.assertFalse(
			frappe.db.exists("Raven Link Preview", {"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"})
		)

	def test_get_previews_returns_stored_rows_keyed_by_raw_url(self):
		from raven.api.preview_links import get_previews

		preview = frappe.new_doc("Raven Link Preview")
		preview.url = f"https://example.com/{frappe.generate_hash(length=12)}"
		preview.provider = "Other"
		preview.status = "Fetched"
		preview.title = "Stored Title"
		preview.insert(ignore_permissions=True)

		# Two raw spellings of the stored URL, plus one the server has
		# nothing for.
		raw_tracked = preview.url + "?utm_source=share"
		results = get_previews([preview.url, raw_tracked, "https://nowhere.example/x"])

		self.assertEqual(results[preview.url]["title"], "Stored Title")
		# The tracked spelling normalizes to the same stored row.
		self.assertEqual(results[raw_tracked]["title"], "Stored Title")
		# The payload carries the normalized url — the realtime patch key.
		self.assertEqual(results[raw_tracked]["url"], preview.url)
		self.assertIsNone(results["https://nowhere.example/x"])

	def test_get_messages_ships_the_previews_sidecar(self):
		from raven.api.chat_stream import get_messages

		# A stored preview for a link that a message shares under a TRACKED
		# raw spelling — the side-car must key by the raw url the message
		# carries, resolving through normalization.
		preview = frappe.new_doc("Raven Link Preview")
		preview.url = f"https://example.com/{frappe.generate_hash(length=12)}"
		preview.provider = "Other"
		preview.status = "Fetched"
		preview.title = "Sidecar Title"
		preview.insert(ignore_permissions=True)

		raw_url = preview.url + "?utm_source=share"
		no_preview_url = f"https://nowhere.example/{frappe.generate_hash(length=12)}"
		self.make_message(
			f'<p><a href="{raw_url}">article</a> and <a href="{no_preview_url}">unknown</a></p>'
		)

		result = get_messages(channel_id=self.channel.name, update_last_visit=False)

		# Keyed by the RAW spelling, exactly as the message ships it.
		self.assertEqual(result["previews"][raw_url]["title"], "Sidecar Title")
		# A link with no stored preview is an explicit None — the client
		# marks it known instead of asking again.
		self.assertIsNone(result["previews"][no_preview_url])

	def test_search_links_filters_by_provider(self):
		from raven.api.search import search_links

		self.make_message(
			'<p><a href="https://github.com/frappe/frappe">repo</a>'
			' <a href="https://vimeo.com/999">video</a></p>'
		)

		# Unfiltered: both links of the message come back, even though
		# neither has a fetched preview yet.
		urls = [row.url for row in search_links(channel_id=self.channel.name)]
		self.assertIn("https://github.com/frappe/frappe", urls)
		self.assertIn("https://vimeo.com/999", urls)

		# Provider filter narrows to the matching child rows.
		filtered = [
			row.url for row in search_links(channel_id=self.channel.name, providers='["GitHub"]')
		]
		self.assertIn("https://github.com/frappe/frappe", filtered)
		self.assertNotIn("https://vimeo.com/999", filtered)

	def test_search_links_respects_workspace_membership(self):
		from raven.api.search import search_links

		# An OPEN channel in a workspace the test user is NOT a member of.
		# The old permission clause ("Open OR channel member") leaked its
		# links to everyone on the site.
		suffix = frappe.generate_hash(length=8)
		frappe.set_user("Administrator")
		other_workspace = frappe.get_doc(
			{
				"doctype": "Raven Workspace",
				"workspace_name": f"Foreign Workspace {suffix}",
				"type": "Public",
			}
		).insert()
		open_channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": f"foreign-open-{suffix}",
				"type": "Open",
				"workspace": other_workspace.name,
			}
		).insert()
		frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": open_channel.name,
				"message_type": "Text",
				"text": '<p><a href="https://leak.example.com/secret">leak</a></p>',
			}
		).insert()

		# The creator is a workspace member — they see the link.
		admin_urls = [row.url for row in search_links(channel_id=open_channel.name)]
		self.assertIn("https://leak.example.com/secret", admin_urls)

		# The test user is not — they must see nothing, Open or not.
		frappe.set_user("test@example.com")
		self.assertEqual(search_links(channel_id=open_channel.name), [])

	def test_process_message_links_upserts_preview_shells(self):
		# Two raw spellings of the same video should share one preview doc.
		message = self.make_message(
			'<p><a href="https://www.youtube.com/watch?v=abc123&utm_source=a">one</a>'
			' <a href="https://www.youtube.com/watch?v=abc123&utm_source=b">two</a></p>'
		)

		process_message_links(message.name)

		previews = frappe.get_all(
			"Raven Link Preview",
			filters={"url": "https://www.youtube.com/watch?v=abc123"},
			fields=["url", "provider", "title", "status"],
		)
		self.assertEqual(len(previews), 1)
		self.assertEqual(previews[0].provider, "YouTube")
		# A shell only. In tests the job never fetches, so the doc stays
		# Pending with no content.
		self.assertFalse(previews[0].title)
		self.assertEqual(previews[0].status, "Pending")

		# Running again (a second message, a retried job) must not duplicate.
		process_message_links(message.name)
		self.assertEqual(
			frappe.db.count("Raven Link Preview", {"url": "https://www.youtube.com/watch?v=abc123"}), 1
		)
