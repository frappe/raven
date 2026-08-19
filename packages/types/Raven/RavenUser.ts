import { RavenPinnedChannels } from './RavenPinnedChannels'
import { RavenUserPinnedWorkspaces } from './RavenUserPinnedWorkspaces'
import { RavenChannelGroups } from '../RavenChannelManagement/RavenChannelGroups'
import { RavenGroupedChannels } from './RavenGroupedChannels'

export interface RavenUser {
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
	/**	Type : Select	*/
	type: "User" | "Bot"
	/**	User : Link - User	*/
	user?: string
	/**	Bot : Link - Raven Bot	*/
	bot?: string
	/**	Enabled : Check	*/
	enabled?: 0 | 1
	/**	Last Mention Viewed On : Datetime	*/
	last_mention_viewed_on?: string
	/**	Full Name : Data	*/
	full_name: string
	/**	First Name : Data	*/
	first_name?: string
	/**	User Image : Attach Image	*/
	user_image?: string
	/**	Pinned Channels : Table - Raven Pinned Channels	*/
	pinned_channels?: RavenPinnedChannels[]
	/**	Pinned Workspaces : Table - Raven User Pinned Workspaces — per-user sidebar ordering	*/
	pinned_workspaces?: RavenUserPinnedWorkspaces[]
	/**	Channel Groups : Table - Raven Channel Groups	*/
	channel_groups?: RavenChannelGroups[]
	/**	Grouped Channels : Table - Raven Grouped Channels	*/
	grouped_channels?: RavenGroupedChannels[]
	/**	Availability Status : Select	*/
	availability_status?: "" | "Available" | "Away" | "Do not disturb" | "Invisible"
	/**	Custom Status : Data	*/
	custom_status?: string
	/**	Chat Style : Select	*/
	chat_style?: "Simple" | "Left-Right"
	/**	Contact Number : Data	*/
	contact_number?: string
	/**	Time Format : Select	*/
	time_format?: "12-hour" | "24-hour"
	/** Only show channels with recent activity: Check */
	filter_recent_activity?: 0 | 1
	/** Only show channels I have joined: Check */
	filter_joined_channels?: 0 | 1
	/** Sort channels by: Select */
	sort_channels_by?: "Alphabetical Order" | "Recent Activity" | "Unreads First"
	/**	Link Previews : Select	*/
	link_previews?: "Link Hover" | "Preview Card"
	/**	Hide Read Receipts : Check	*/
	hide_read_receipts?: 0 | 1
	/**	Quiet Hours Nudge : Select	*/
	quiet_hours_nudge?: "Nudge" | "No Nudge" | "Auto Silent"
}