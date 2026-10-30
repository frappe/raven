import re

import frappe

_MAX_NAME = 200
_MAX_VALUE = 200
_MAX_LABEL = 50
_MAX_ITEMS = 10
_KNOWN_LABELS = ("Mobile", "Home", "Work", "Main", "Other")

# iOS wraps its default labels as _$!<Mobile>!$_, which strip_html_tags would mangle.
_IOS_LABEL_WRAPPER = re.compile(r"^_\$!<(.*)>!\$_$")


def _clean_text(value) -> str | None:
	"""Visible text from an untrusted string, or None."""
	if not isinstance(value, str):
		return None
	return frappe.utils.strip_html_tags(value).strip() or None


def _sane_text(value, limit: int) -> str | None:
	"""Visible text cut to `limit` characters, or None."""
	text = _clean_text(value)
	return text[:limit] if text else None


def _sane_label(value) -> str | None:
	"""A known label in its canonical spelling, the given label if short, or None."""
	if not isinstance(value, str):
		return None
	unwrapped = _IOS_LABEL_WRAPPER.sub(r"\1", value.strip())
	for label in _KNOWN_LABELS:
		if unwrapped.lower() == label.lower():
			return label
	text = _clean_text(unwrapped)
	return text if text and len(text) <= _MAX_LABEL else None


def _sane_entries(value) -> list[dict]:
	"""`{value, label?}` entries with junk dropped, capped at _MAX_ITEMS."""
	if not isinstance(value, list):
		return []
	entries = []
	for item in value:
		if len(entries) == _MAX_ITEMS:
			break
		if not isinstance(item, dict):
			continue
		text = _sane_text(item.get("value"), _MAX_VALUE)
		if not text:
			continue
		entry = {"value": text}
		label = _sane_label(item.get("label"))
		if label:
			entry["label"] = label
		entries.append(entry)
	return entries


def sane_contact(value) -> dict | None:
	"""A plausible contact payload from an untrusted client, or None."""
	if not isinstance(value, dict):
		return None
	name = _sane_text(value.get("name"), _MAX_NAME)
	if not name:
		return None
	phones = _sane_entries(value.get("phones"))
	emails = _sane_entries(value.get("emails"))
	if not phones and not emails:
		return None
	return {"name": name, "phones": phones, "emails": emails}


def contact_fallback_html(contact: dict) -> str:
	"""Plain lines for clients that can't draw the contact card."""
	values = [contact["name"]]
	values += [phone["value"] for phone in contact["phones"]]
	values += [email["value"] for email in contact["emails"]]
	lines = "<br>".join(frappe.utils.escape_html(value) for value in values)
	return f"<p>{lines}</p>"
