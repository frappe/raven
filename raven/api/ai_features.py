import frappe
import openai

from raven.ai.handler import get_variables_for_instructions


@frappe.whitelist(methods=["GET"])
def get_instruction_preview(instruction: str):
	"""
	Function to get the rendered instructions for the bot
	"""
	frappe.has_permission(doctype="Raven Bot", ptype="write", throw=True)

	# Only users who can edit Raven Bots reach this line. The renderer is sandboxed.
	# nosemgrep: frappe-ssti
	instructions = frappe.render_template(instruction, get_variables_for_instructions())
	return instructions


@frappe.whitelist()
def get_saved_prompts(bot: str = None):
	"""
	API to get the saved prompt for a user/bot/global
	"""
	or_filters = [["is_global", "=", 1], ["owner", "=", frappe.session.user]]

	prompts = frappe.get_list(
		"Raven Bot AI Prompt", or_filters=or_filters, fields=["name", "prompt", "is_global", "raven_bot"]
	)

	# Order by ones with the given bot
	prompts = sorted(prompts, key=lambda x: x.get("raven_bot") == bot, reverse=True)

	return prompts


@frappe.whitelist()
def get_open_ai_version():
	"""
	API to get the version of the OpenAI Python client
	"""
	frappe.has_permission(doctype="Raven Bot", ptype="read", throw=True)
	return openai.__version__


@frappe.whitelist()
def get_openai_available_models():
	"""
	API to get the available OpenAI models for assistants
	"""
	frappe.has_permission(doctype="Raven Bot", ptype="read", throw=True)
	from raven.ai.openai_client import get_openai_models

	models = get_openai_models()

	valid_prefixes = ["gpt-4", "gpt-3.5", "o1", "o3-mini"]

	# Model should not contain these words
	invalid_models = ["realtime", "transcribe", "search", "audio"]

	compatible_models = []

	for model in models:
		if any(model.id.startswith(prefix) for prefix in valid_prefixes):
			if not any(word in model.id for word in invalid_models):
				compatible_models.append(model.id)

	return compatible_models


@frappe.whitelist()
def test_llm_configuration(
	provider: str = "OpenAI", api_url: str = None, local_llm_provider: str = None
):
	"""
	Test LLM configuration (OpenAI or Local LLM)
	"""
	frappe.has_permission(doctype="Raven Settings", ptype="write", throw=True)

	# Only System Managers choose which LLM server Raven talks to.
	# Anyone else (like a Raven Admin) can only test the saved one.
	if provider == "Local LLM" and "System Manager" not in frappe.get_roles():
		settings = frappe.get_cached_doc("Raven Settings")
		api_url, local_llm_provider = settings.local_llm_api_url, settings.local_llm_provider

	try:
		if provider == "Local LLM" and api_url:
			# Test local LLM endpoint
			import requests

			# Check if it's OpenAI Compatible and get API key
			api_key = None
			if local_llm_provider == "OpenAI Compatible":
				settings = frappe.get_single("Raven Settings")
				api_key = settings.get_password("openai_compatible_api_key")
				if not api_key:
					return {
						"success": False,
						"message": "OpenAI Compatible API Key is required",
					}

			if api_key:
				# Use OpenAI client for OpenAI Compatible services
				client = openai.OpenAI(api_key=api_key, base_url=api_url)
				models = client.models.list()
				return {
					"success": True,
					"message": f"Successfully connected to OpenAI Compatible service at {api_url}",
					"models": [{"id": m.id} for m in models.data],
				}
			else:
				# For other local LLM providers, use direct HTTP request
				response = requests.get(f"{api_url}/models", timeout=5)
				if response.status_code == 200:
					models = response.json()
					return {
						"success": True,
						"message": f"Successfully connected to {api_url}",
						"models": models.get("data", []),
					}
				else:
					return {
						"success": False,
						"message": f"Failed to connect to {api_url}. Status: {response.status_code}",
					}

		elif provider == "OpenAI":
			# Test OpenAI configuration
			from raven.ai.openai_client import get_open_ai_client

			client = get_open_ai_client()
			# Try to list models
			models = client.models.list()
			return {
				"success": True,
				"message": "Successfully connected to OpenAI",
				"models": [{"id": m.id} for m in models.data[:5]],  # Return first 5 models
			}

	except Exception as e:
		return {"success": False, "message": f"Connection failed: {str(e)}"}
