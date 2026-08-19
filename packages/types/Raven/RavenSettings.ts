import { RavenHRCompanyWorkspace } from '../RavenIntegrations/RavenHRCompanyWorkspace'
import { RavenBlockedLinks } from './RavenBlockedLinks'

export interface RavenSettings{
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
	/**	Automatically add system users to Raven : Check	*/
	auto_add_system_users?: 0 | 1
	/**	Show Raven on Desk : Check	*/
	show_raven_on_desk?: 0 | 1
	/**	Tenor API Key : Data	*/
	tenor_api_key?: string
	/**	Enable AI Integration : Check	*/
	enable_ai_integration?: 0 | 1
	/**	Enable OpenAI Services : Check	*/
	enable_openai_services?: 0 | 1
	/**	OpenAI Organisation ID : Data	*/
	openai_organisation_id?: string
	/**	OpenAI API Key : Password	*/
	openai_api_key?: string
	/**	OpenAI Project ID : Data - If not set, the integration will use the default project	*/
	openai_project_id?: string
	/**	Enable Local LLM : Check	*/
	enable_local_llm?: 0 | 1
	/**	Local LLM Provider : Select	*/
	local_llm_provider?: "LM Studio" | "Ollama" | "LocalAI" | "OpenAI Compatible"
	/**	Local LLM API URL : Data	*/
	local_llm_api_url?: string
	/**	OpenAI Compatible API Key : Password	*/
	openai_compatible_api_key?: string
	/**	Enable Google APIs : Check - Useful for extracting information from documents before sending it to agents	*/
	enable_google_apis?: 0 | 1
	/**	Google Processor Location : Select	*/
	google_processor_location?: "us" | "eu"
	/**	Google Project ID : Data	*/
	google_project_id?: string
	/**	Google Service Account JSON Key : Password	*/
	google_service_account_json_key?: string
	/**	Automatically Create a Channel for each Department : Check - If checked, a channel will be created in Raven for each department and employees will be synced with Raven Users.	*/
	auto_create_department_channel?: 0 | 1
	/**	Department Channel Type : Select	*/
	department_channel_type?: "Public" | "Private"
	/**	Company Workspace Mapping : Table - Raven HR Company Workspace	*/
	company_workspace_mapping?: RavenHRCompanyWorkspace[]
	/**	Show if a user is on leave : Check	*/
	show_if_a_user_is_on_leave?: 0 | 1
	/**	OAuth Client : Link - OAuth Client	*/
	oauth_client?: string
	/**	Push Notification Service : Select	*/
	push_notification_service?: "Frappe Cloud" | "Raven"
	/**	Push Notification Server URL : Data	*/
	push_notification_server_url?: string
	/**	Push Notification API Key : Data	*/
	push_notification_api_key?: string
	/**	Push Notification API Secret : Password	*/
	push_notification_api_secret?: string
	/**	Config : Small Text	*/
	config?: string
	/**	VAPID Public Key : Data	*/
	vapid_public_key?: string
	/**	Enable Video Calling via LiveKit : Check	*/
	enable_video_calling_via_livekit?: 0 | 1
	/**	LiveKit URL : Data	*/
	livekit_url?: string
	/**	LiveKit API Key : Data	*/
	livekit_api_key?: string
	/**	LiveKit API Secret : Password	*/
	livekit_api_secret?: string
	/**	Frappe Meet Hosted URLs : Small Text	*/
	frappe_meet_hosted_urls?: string
	/**	Blocked Links : Table - Raven Blocked Links	*/
	blocked_links?: RavenBlockedLinks[]
	/**	Enable Quiet Hours : Check	*/
	enable_quiet_hours?: 0 | 1
	/**	Working Hours Start : Time	*/
	working_hours_start?: string
	/**	Working Hours End : Time	*/
	working_hours_end?: string
}