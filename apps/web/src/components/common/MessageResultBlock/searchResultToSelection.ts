import type { SelectedNotification } from "@pages/notifications/NotificationChat"
import type { UserData } from "@db"

/**
 * Build the right-pane selection (`SelectedNotification`) from a search-result row.
 *
 * Routing model — a message can live in three places:
 *  - a normal channel: `channel_id` == `parent_channel_id`, `is_thread` = 0
 *  - inside a thread:   `channel_id` = the thread channel, `parent_channel_id` = the parent
 *  - a thread ROOT:     `is_thread` = 1; a thread's id IS its root message's id
 *
 * For anything that lives in / starts a thread the pane opens in thread mode, where
 * `channelID` is consumed as the THREAD id. So we hand it the thread id — the thread
 * channel for a reply, the message id itself for a root — NOT the parent channel.
 * (The old bug: replies passed `parent_channel_id` + `isThread=0`, so they opened the
 * parent channel instead of the thread.)
 */
export function searchResultToSelection(params: {
	messageID: string
	channelID: string
	parentChannelID?: string
	isThreadRoot: boolean
	isDirectMessage: boolean
	peer?: UserData
}): SelectedNotification {
	const { messageID, channelID, parentChannelID, isThreadRoot, isDirectMessage, peer } = params

	const isThreadMessage = !!parentChannelID && parentChannelID !== channelID
	const opensThread = isThreadMessage || isThreadRoot
	const threadID = isThreadMessage ? channelID : messageID

	return {
		channelID: opensThread ? threadID : channelID,
		messageID,
		isDirectMessage,
		peer,
		isThread: opensThread,
	}
}
