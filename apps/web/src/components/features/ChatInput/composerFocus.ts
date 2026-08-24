/**
 * A tiny per-channel registry for "focus the composer". The editor lives in ChatInput, but
 * things that should refocus it (the pane-level FileDropZone, for one) sit elsewhere in the
 * tree — too far for a prop. ChatInput registers its editor's focus fn here per channel, and
 * any attach path calls focusComposer(channelID) after the drag/dialog steals focus.
 *
 * A plain module Map, not a jotai atom: callers only ever invoke it imperatively (no render
 * depends on it), so there's nothing to subscribe to.
 */
const registry = new Map<string, () => void>()

/** Register a channel's composer-focus fn; returns an unregister cleanup. */
export const registerComposerFocus = (channelID: string, focus: () => void): (() => void) => {
    registry.set(channelID, focus)
    return () => {
        if (registry.get(channelID) === focus) registry.delete(channelID)
    }
}

/** Focus a channel's composer if one is mounted. */
export const focusComposer = (channelID: string) => {
    registry.get(channelID)?.()
}
