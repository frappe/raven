/**
 * What the search UI can actually narrow by. The backend accepts more (pinned, saved,
 * reactions, mentions, channel type, bot…), but nothing in the app sets those, so they
 * are not modelled here — add a field back when a control exists to drive it.
 */
export interface SearchFilters {
    query?: string,
    channel_id?: string,
    owner?: string,
    /** Set by the result tabs, not the filter bar: each tab searches its own kind. */
    message_type?: string[] | string,
    file_type?: string[],
    /** Provider group ids from ProviderFilter — only the Links tab uses it. */
    link_provider?: string[],
    /** Only the channel's thread list sets this. */
    is_thread?: 1 | 0 | null,
}
