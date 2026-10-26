import math

import frappe


def _sane_number(value) -> float | None:
	"""A finite number from an untrusted client, or None."""
	if isinstance(value, bool):
		return None
	try:
		number = float(value)
	except (TypeError, ValueError):
		return None
	return number if math.isfinite(number) else None


# Mirror of inCoordinateRange in apps/web/src/lib/location.ts — keep in sync.
def _sane_coordinate(value, limit: float) -> float | None:
	"""A coordinate within ±limit, rounded to ~0.1 m, or None."""
	number = _sane_number(value)
	if number is None or not -limit <= number <= limit:
		return None
	return round(number, 6)


def sane_location(value) -> dict | None:
	"""A plausible location payload from an untrusted client, or None."""
	if not isinstance(value, dict):
		return None
	latitude = _sane_coordinate(value.get("latitude"), 90)
	longitude = _sane_coordinate(value.get("longitude"), 180)
	if latitude is None or longitude is None:
		return None
	return {"latitude": latitude, "longitude": longitude}


# Mirror of appleMapsUrl / googleMapsUrl in apps/web/src/lib/location.ts — keep in sync.
def maps_url(location: dict, provider: str | None = None) -> str:
	"""The maps link for a location, in the sender's app; Google unless Apple is asked for."""
	latitude = location["latitude"]
	longitude = location["longitude"]
	if provider == "apple":
		return f"https://maps.apple.com/?ll={latitude},{longitude}&q=Location"
	return f"https://www.google.com/maps/search/?api=1&query={latitude},{longitude}"


def location_link_html(url: str) -> str:
	"""A plain link for clients that can't draw the location card."""
	escaped = frappe.utils.escape_html(url)
	return f'<p><a href="{escaped}">{escaped}</a></p>'
