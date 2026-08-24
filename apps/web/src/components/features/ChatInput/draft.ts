import { useSyncExternalStore } from "react"

/**
 * Per-channel composer drafts, persisted to localStorage so in-progress text
 * survives channel switches and refreshes (v2 parity). Drafts are plain editor HTML
 * keyed by channel; mentions / custom emojis round-trip because their nodes
 * re-parse from the stored markup.
 *
 * localStorage is mirrored in a small in-memory cache with subscribers, so the
 * sidebars can show live draft indicators (useChannelDraft) — the composer
 * writes on a debounce and every write notifies.
 */
const key = (channelID: string) => `raven-draft-${channelID}`

/** In-memory mirror of the persisted drafts, lazily filled on first read. */
const cache = new Map<string, string>()
const listeners = new Set<() => void>()

/** The saved draft HTML for a channel, or "" if none. */
export const loadDraft = (channelID: string): string => {
    const cached = cache.get(channelID)
    if (cached !== undefined) return cached
    let value = ""
    try {
        value = localStorage.getItem(key(channelID)) ?? ""
    } catch {
        // Private-mode read failures — treat as no draft.
    }
    cache.set(channelID, value)
    return value
}

/** Persist the draft, or clear it when empty. Notifies indicator subscribers. */
export const saveDraft = (channelID: string, html: string): void => {
    try {
        if (html) localStorage.setItem(key(channelID), html)
        else localStorage.removeItem(key(channelID))
    } catch {
        // Ignore quota / private-mode write failures — a lost draft is non-critical.
    }
    const previous = cache.get(channelID)
    cache.set(channelID, html)
    if (previous !== html) for (const listener of listeners) listener()
}

/**
 * Plain-text teaser of a channel's draft ("" when none) — what the sidebar
 * rows show. Strips the editor HTML down to readable text.
 */
export const getDraftTeaser = (channelID: string): string => {
    const html = loadDraft(channelID)
    if (!html) return ""
    return html
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim()
}

const subscribeDrafts = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

/**
 * Live draft teaser for a channel ("" when none). The snapshot is a primitive
 * string, so a draft change only re-renders rows whose teaser actually changed —
 * every other subscribed row bails on the Object.is compare.
 */
export const useChannelDraft = (channelID: string): string =>
    useSyncExternalStore(subscribeDrafts, () => getDraftTeaser(channelID))
