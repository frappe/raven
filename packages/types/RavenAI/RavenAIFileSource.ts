
export interface RavenAIFileSource{
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
	/**	File Name : Data	*/
	file_name?: string
	/**	File : Attach	*/
	file: string
	/**	File Type : Data	*/
	file_type?: string
	/**	OpenAI File ID : Data	*/
	openai_file_id?: string
}