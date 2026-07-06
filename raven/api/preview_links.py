import json
import re

import frappe
from frappe import _
from linkpreview import Link, LinkGrabber, LinkPreview, link_preview


@frappe.whitelist(methods=["GET"])
def get_preview_link(urls: list[str] | str):

	data = {}
	empty_data = {
		"title": "",
		"description": "",
		"image": "",
		"force_title": "",
		"absolute_image": "",
		"site_name": "",
	}
	message_links = []

	if urls and urls != "[]":
		urls = json.loads(urls)

		for url in urls:
			data = frappe.cache().get_value(url)
			if data == None:
				# Don't try to preview insecure links like IP addresses
				# If URL is an IP address, or starts with mailto or tel, don't preview. Just return empty data
				if (
					url.startswith("mailto")
					or url.startswith("tel")
					or re.match(r"http://\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.*", url)
					or re.match(r"https://\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.*", url)
					or re.match(r"http://\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}", url)
					or re.match(r"https://\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}", url)
				):
					data = empty_data
				else:
					preview = None
					try:
						# If this is a Twitter/X URL, then we need to fetch the preview from the Twitter API
						# This is because the linkpreview library doesn't support Twitter previews with the default bot
						if "twitter.com" in url or "x.com" in url:
							grabber = LinkGrabber()
							content, url_fetched = grabber.get_content(url, headers="imessagebot")
							link = Link(url_fetched, content)
							preview = LinkPreview(link)
						else:
							preview = link_preview(url)
					except Exception:
						preview = None
						pass
					if preview == None:
						data = empty_data
					else:

						# Description might have emojis in them, which comes in with special characters like copyright etc
						# TODO: We need to replace these special characters with the actual emojis

						data = {
							"title": str(preview.title or ""),
							"description": str(preview.description or ""),
							"image": str(preview.image or ""),
							"force_title": str(preview.force_title or ""),
							"absolute_image": str(preview.absolute_image or ""),
							"site_name": str(preview.site_name or ""),
						}
					frappe.cache().set_value(url, data)
			message_links.append(data)

	return message_links


@frappe.whitelist(methods=["POST"])
def hide_link_preview(message_id: str):
	"""
	Remove the preview from the message
	"""
	message = frappe.get_doc("Raven Message", message_id)

	if not message.has_permission():
		frappe.throw(_("You do not have permission to hide link previews on this message."))

	message.flags.ignore_permissions = True
	message.hide_link_preview = 1
	message.flags.editing_metadata = True
	message.save()
