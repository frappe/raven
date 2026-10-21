// Files from an OS share, held for one channel: ShareTarget stashes them for the channel the user
// picks, and that channel's composer takes them on mount. Plain module state; no Capacitor involved.
let stash: { channelID: string; files: File[] } | null = null

export const stashSharedFiles = (channelID: string, files: File[]) => {
    stash = files.length ? { channelID, files } : null
}

/** The files held for this channel, emptied on read. Any other channel gets none. */
export const consumeSharedFiles = (channelID: string): File[] => {
    if (stash?.channelID !== channelID) return []
    const { files } = stash
    stash = null
    return files
}
