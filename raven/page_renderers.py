import os

import frappe
from frappe.website.page_renderers.base_renderer import BaseRenderer
from werkzeug.wrappers import Response


class RavenV3ServiceWorker(BaseRenderer):
	"""
	Serves the v3 web app's service worker at /raven/sw.js.

	The script must be served from WITHIN the app's path (not /assets/...):
	a service worker's scope is capped at the directory it is served from, and
	the offline app shell + web share target both need the worker to control
	/raven/* pages. Serving through a page renderer keeps this pure app code —
	no nginx configuration — since non-asset paths always reach Python.

	Cache-Control: no-cache makes browsers revalidate the script on each
	registration check, so deploys roll out without a stale-worker window.
	"""

	def can_render(self):
		# The route rules rewrite /raven/* to the SPA endpoint before
		# renderers run, so match on the ORIGINAL request path.
		request = getattr(frappe.local, "request", None)
		return bool(request) and request.path == "/raven/sw.js"

	def render(self):
		file_path = frappe.get_app_path("raven", "public", "raven", "sw.js")
		if not os.path.exists(file_path):
			return Response("// service worker not built", status=404, mimetype="text/javascript")
		with open(file_path, "rb") as f:
			content = f.read()
		return Response(
			content,
			mimetype="text/javascript",
			headers={"Cache-Control": "no-cache, max-age=0, must-revalidate"},
		)
