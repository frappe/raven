
export interface RavenUserChannels{
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
	/**	Channel ID : Link - Raven Channel	*/
	channel_id: string
	/**	Channel Group : Link - Raven Channel Groups	*/
	channel_group?: string
}