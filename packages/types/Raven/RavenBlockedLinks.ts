export interface RavenBlockedLinks {
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
	/**	Link : Small Text	*/
	link: string
	/**	Match Exact : Check	*/
	match_exact?: 0 | 1
}
