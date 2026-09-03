import { RavenBotFunctions } from '../RavenAI/RavenBotFunctions'

export interface RavenBot{
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
	/**	Bot Name : Data	*/
	bot_name: string
	/**	Image : Attach Image	*/
	image?: string
	/**	Raven User : Link - Raven User	*/
	raven_user?: string
	/**	Description : Small Text	*/
	description?: string
	/**	Is Standard : Check	*/
	is_standard?: 0 | 1
	/**	Module : Link - Module Def	*/
	module?: string
	/**	Is AI Bot? : Check	*/
	is_ai_bot?: 0 | 1
	/**	Debug Mode : Check - If enabled, stack traces of errors will be sent as messages by the bot 	*/
	debug_mode?: 0 | 1
	/**	OpenAI Assistant ID : Data	*/
	openai_assistant_id?: string
	/**	Enable Code Interpreter : Check -  Enable this if you want the bot to be able to process files like Excel sheets or data from Insights.
                    <br>
                    OpenAI Assistants run code in a sandboxed environment (on OpenAI servers) to do this.	*/
	enable_code_interpreter?: 0 | 1
	/**	Allow Bot to Write Documents : Check	*/
	allow_bot_to_write_documents?: 0 | 1
	/**	Enable File Search : Check - Enable this if you want the bot to be able to read PDF files and scan them.

File search enables the assistant with knowledge from files that you upload. Once a file is uploaded, the assistant automatically decides when to retrieve content based on user requests.	*/
	enable_file_search?: 0 | 1
	/**	Instruction : Long Text - You can use Jinja variables here to customize the instruction to the bot at run time if dynamic instructions are enabled.	*/
	instruction?: string
	/**	Dynamic Instructions : Check - Dynamic Instructions allow you to embed Jinja tags in your instruction to the bot. Hence the instruction would be different based on the user who is calling the bot or the data in your system. These instructions are computed every time the bot is called. Check this if you want to embed things like Employee ID, Company Name etc in your instructions dynamically	*/
	dynamic_instructions?: 0 | 1
	/**	Bot Functions : Table - Raven Bot Functions	*/
	bot_functions?: RavenBotFunctions[]
	/**	Enable base64 image encoding for Local LLM vision : Check - When images are sent to a Local LLM agent, encode them as base64 and include them directly in the request.	*/
	enable_vision_base64?: 0 | 1
}