import { atomWithStorage } from "jotai/utils"

/**
 * "Reopen where I left off" memory — read by the boot/index redirect and
 * WorkspaceRedirect, written by the Channel page as a PAIR (a channel implies
 * its workspace), so the stored channel always belongs to the stored
 * workspace. Storage keys/format match v2's lastVisitedAtoms, so both apps
 * share the memory during the coexistence window.
 *
 * getOnInit: read from localStorage on first subscription — and unlike a
 * module-scope read, atom reads are live: the index route re-evaluates with
 * current values every time you navigate home.
 */
export const lastWorkspaceAtom = atomWithStorage<string>("ravenLastWorkspace", "", undefined, {
    getOnInit: true,
})

export const lastChannelAtom = atomWithStorage<string>("ravenLastChannel", "", undefined, {
    getOnInit: true,
})
