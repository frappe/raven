from . import __version__ as app_version

app_name = "raven"
app_title = "Raven"
app_publisher = "The Commit Company (Algocode Technologies Pvt. Ltd.)"
app_description = "Messaging Application"
app_email = "support@thecommit.company"
app_license = "AGPLv3"
source_link = "https://github.com/The-Commit-Company/Raven"
app_logo = "/assets/raven/raven_logo.svg"
app_logo_url = "/assets/raven/raven_logo.svg"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
app_include_css = "raven.bundle.css"
# app_include_css = "/assets/raven/css/raven.css"
# app_include_js = "/assets/raven/js/raven.js"                 ]
app_include_js = "raven.bundle.js"

add_to_apps_screen = [
	{
		"name": "raven",
		"logo": "/assets/raven/raven_logo.svg",
		"title": "Raven",
		"route": "/raven",
		"has_permission": "raven.permissions.check_app_permission",
	}
]


sounds = [
	{
		"name": "raven_notification",
		"src": "/assets/raven/sounds/raven_notification.mp3",
		"volume": 0.2,
	},
]

extend_bootinfo = "raven.boot.boot_session"
# include js, css files in header of web template
# web_include_css = "/assets/raven/css/raven.css"
# web_include_js = "/assets/raven/js/raven.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "raven/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# "Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# "methods": "raven.utils.jinja_methods",
# "filters": "raven.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "raven.install.before_install"
after_install = "raven.install.after_install"
# after_sync = ""

# Uninstallation
# ------------

# before_uninstall = "raven.uninstall.before_uninstall"
after_uninstall = "raven.uninstall.after_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "raven.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# "Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# "Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# "ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	"*": {
		"after_insert": "raven.raven_integrations.doctype.raven_document_notification.raven_document_notification.run_document_notification",
		"on_update": "raven.raven_integrations.doctype.raven_document_notification.raven_document_notification.run_document_notification",
		"on_trash": "raven.raven_integrations.doctype.raven_document_notification.raven_document_notification.run_document_notification",
		"on_cancel": "raven.raven_integrations.doctype.raven_document_notification.raven_document_notification.run_document_notification",
		"on_submit": "raven.raven_integrations.doctype.raven_document_notification.raven_document_notification.run_document_notification",
	},
	"User": {
		"after_insert": "raven.raven.doctype.raven_user.raven_user.add_user_to_raven",
		"on_update": "raven.raven.doctype.raven_user.raven_user.add_user_to_raven",
		"on_trash": "raven.raven.doctype.raven_user.raven_user.remove_user_from_raven",
	},
	"Department": {
		"after_insert": "raven.raven_integrations.controllers.department.after_insert",
		"on_update": "raven.raven_integrations.controllers.department.on_update",
		"on_trash": "raven.raven_integrations.controllers.department.on_trash",
	},
	"Employee": {
		"after_insert": "raven.raven_integrations.controllers.employee.after_insert",
		"on_update": "raven.raven_integrations.controllers.employee.on_update",
		"on_trash": "raven.raven_integrations.controllers.employee.on_trash",
	},
}

# Scheduled Tasks
# ---------------

scheduler_events = {
	# "all": [
	# 	"raven.scheduler.all"
	# ],
	# "daily": [
	# 	"raven.scheduler.daily"
	# ],
	# "hourly": [
	# 	"raven.scheduler.hourly"
	# ],
	# "weekly": [
	# 	"raven.scheduler.weekly"
	# ],
	# "monthly": [
	# 	"raven.scheduler.monthly"
	# ],
	"daily_maintenance": [
		"raven.scheduler.daily.sync_invalid_tokens",
		"raven.raven_cloud_notifications.sync_users_tokens_to_raven_cloud",
	],
	"cron": {
		# run every 5 minutes
		"*/5 * * * *": ["raven.scheduler.close_expired_polls.close_expired_polls"]
	},
}

# Testing
# -------

# before_tests = "raven.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# "frappe.desk.doctype.event.event.get_events": "raven.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# "Task": "raven.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

ignore_links_on_delete = ["Raven Message"]


# User Data Protection
# --------------------

# user_data_fields = [
# {
# "doctype": "{doctype_1}",
# "filter_by": "{filter_by}",
# "redact_fields": ["{field_1}", "{field_2}"],
# "partial": 1,
# },
# {
# "doctype": "{doctype_2}",
# "filter_by": "{filter_by}",
# "partial": 1,
# },
# {
# "doctype": "{doctype_3}",
# "strict": False,
# },
# {
# "doctype": "{doctype_4}"
# }
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# "raven.auth.validate"
# ]

additional_timeline_content = {"*": ["raven.api.raven_message.get_timeline_message_content"]}

# /raven serves the v3 app; the old (v2) app lives on at /raven_v2.
website_route_rules = [
	{"from_route": "/raven/<path:app_path>", "to_route": "raven"},
	{"from_route": "/raven_v2/<path:app_path>", "to_route": "raven_v2"},
]

# v3 lived at /raven_v3 during the beta — installed PWAs and shared links from
# that era land on the real mount. Regex source with a capture so deep links
# keep their path.
website_redirects = [
	{"source": r"/raven_v3(/.*)?", "target": r"/raven\1"},
]

# Serves the v3 service worker at /raven/sw.js (in-scope for page control —
# offline app shell + share target). See raven/page_renderers.py for why.
page_renderer = ["raven.page_renderers.RavenV3ServiceWorker"]

permission_query_conditions = {
	"Raven Channel": "raven.permissions.raven_channel_query",
	"Raven Message": "raven.permissions.raven_message_query",
	"Raven Poll": "raven.permissions.raven_poll_query",
	"Raven Poll Vote": "raven.permissions.raven_poll_vote_query",
	"Raven Workspace": "raven.permissions.raven_workspace_query",
	"Raven Workspace Member": "raven.permissions.raven_workspace_member_query",
	"Raven Channel Member": "raven.permissions.raven_channel_member_query",
}

has_permission = {
	"Raven Channel": "raven.permissions.channel_has_permission",
	"Raven Channel Member": "raven.permissions.channel_member_has_permission",
	"Raven Message": "raven.permissions.message_has_permission",
	"Raven Poll Vote": "raven.permissions.raven_poll_vote_has_permission",
	"Raven Poll": "raven.permissions.raven_poll_has_permission",
	"Raven User": "raven.permissions.raven_user_has_permission",
	"Raven Workspace Member": "raven.permissions.workspace_member_has_permission",
	"Raven Workspace": "raven.permissions.workspace_has_permission",
}

on_session_creation = "raven.api.user_availability.set_user_active"
on_logout = "raven.api.user_availability.set_user_inactive"

export_python_type_annotations = True
require_type_annotated_api_methods = True

raven_document_link_override = "raven.api.document_link.get_new_app_document_links"

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
ignore_translatable_strings_from = ["frappe"]

sqlite_search = ["raven.api.search.RavenSearch"]
