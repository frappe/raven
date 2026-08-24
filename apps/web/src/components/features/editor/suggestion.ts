import { PluginKey } from "@tiptap/pm/state"

/**
 * Plugin keys for the editor's "type a trigger → popup" extensions. Each Suggestion
 * needs its own key; they're declared here so all the editor pieces share them.
 */
export const userMentionPluginKey = new PluginKey("userMentionSuggestion")
export const channelMentionPluginKey = new PluginKey("channelMentionSuggestion")
export const emojiPluginKey = new PluginKey("emojiSuggestion")

/**
 * How many suggestion popups are currently showing items. The editor's Enter handler
 * checks this to defer Enter to the popup (pick the highlighted item) instead of
 * submitting. We count VISIBLE popups (items > 0), not merely "active" suggestion
 * plugins — so a bare ":" with no matches, or "@zzz" matching nobody, still sends on
 * Enter. The suggestion render (createSuggestion) keeps the count in sync.
 */
let openPopups = 0

export const isSuggestionPopupOpen = () => openPopups > 0

/** Called by a suggestion render as its popup gains/loses visible items. */
export const setSuggestionPopupVisible = (wasVisible: boolean, isVisible: boolean) => {
    if (isVisible && !wasVisible) openPopups += 1
    else if (!isVisible && wasVisible) openPopups = Math.max(0, openPopups - 1)
}
