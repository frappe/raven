import math
import frappe

def create():
	frappe.set_user("aditya.p@frappe.io")
	content = open("/private/tmp/claude-501/-Users-aditya-Desktop-raven-bench-apps-raven/07f47080-1574-4335-8071-cca57496a5a9/scratchpad/voice-note-demo.m4a", "rb").read()
	f = frappe.get_doc({"doctype": "File", "file_name": "voice-note-demo.m4a", "content": content, "is_private": 1, "attached_to_doctype": "Raven Message"}).insert(ignore_permissions=True)
	from raven.api.raven_message import send_message_with_attachments
	waveform = [round(20 + 70 * abs(math.sin(i / 3.1))) for i in range(48)]
	msgs = send_message_with_attachments(channel_id="test-general", files=[{"file_url": f.file_url, "file_size": f.file_size, "voice": {"duration": 4.0, "waveform": waveform}}])
	frappe.db.commit()
	return {"message": msgs[0].name, "type": msgs[0].message_type, "file": f.name}

def remove(message, file):
	frappe.set_user("Administrator")
	frappe.delete_doc("Raven Message", message, force=True)
	frappe.delete_doc("File", file, force=True)
	frappe.db.commit()
	return "removed"
