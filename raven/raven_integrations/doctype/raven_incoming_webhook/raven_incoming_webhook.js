// Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.ui.form.on("Raven Incoming Webhook", {
	refresh(frm) {
		const url = new URL(`/api/method/raven.webhook/${frm.doc.name}`, window.location.origin);
		frm.set_value("webhook_url", url.toString());
	},
});
