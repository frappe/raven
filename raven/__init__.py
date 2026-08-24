__version__ = "3.0.0"

from raven.raven_integrations.doctype.raven_incoming_webhook.raven_incoming_webhook import (  # noqa
	handle_incoming_webhook as webhook,
)
