import { RavenDocumentNotificationRecipients } from './RavenDocumentNotificationRecipients'

export interface RavenDocumentNotification{
	creation: string
	name: string
	modified: string
	owner: string
	modified_by: string
	docstatus: 0 | 1 | 2
	parent?: string
	parentfield?: string
	parenttype?: string
	idx?: number
	/**	Notification Name : Data	*/
	notification_name: string
	/**	Enabled : Check	*/
	enabled?: 0 | 1
	/**	Sender : Link - Raven Bot	*/
	sender: string
	/**	Send Alert On : Select	*/
	send_alert_on: "New Document" | "Update" | "Submit" | "Cancel" | "Delete"
	/**	Document Type : Link - DocType	*/
	document_type: string
	/**	Do not attach document with message : Check - If enabled, the message won't have a document preview	*/
	do_not_attach_doc?: 0 | 1
	/**	Condition : Code - Optional: The alert will be sent if this expression is true	*/
	condition?: string
	/**	Recipients : Table - Raven Document Notification Recipients	*/
	recipients: RavenDocumentNotificationRecipients[]
	/**	Message : Code - Can be HTML/Markdown/Plain Text. Support Jinja tags	*/
	message: string
}
