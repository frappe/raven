
export interface RavenDocumentNotificationRecipients{
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
	/**	Channel Type : Select	*/
	channel_type: "Channel" | "User"
	/**	Variable Type : Select	*/
	variable_type: "Static" | "DocField" | "Jinja"
	/**	Value : Data	*/
	value: string
}
