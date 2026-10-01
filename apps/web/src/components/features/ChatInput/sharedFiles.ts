// Files from an OS share: ShareTarget stashes them, the composer of the chosen channel takes them
// on mount. Plain module state, emptied on read; no Capacitor involved.
let sharedFiles: File[] = []

export const stashSharedFiles = (files: File[]) => {
    sharedFiles = files
}

/** The stash without emptying it: ShareTarget previews what the composer will take. */
export const peekSharedFiles = (): File[] => sharedFiles

export const consumeSharedFiles = (): File[] => {
    const files = sharedFiles
    sharedFiles = []
    return files
}
