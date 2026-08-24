import { useCallback } from "react"
import { useSetAtom } from "jotai"
import { channelDrawerAtom, pollDrawerAtom, type DrawerType } from "@utils/channelAtoms"

/**
 * Setter for the channel context drawer (members / files / pins / links / settings) that also
 * closes the poll drawer when opening one — the rail has a single slot, so the drawers are
 * mutually exclusive. Cleared at the open site (deterministic) rather than via an effect.
 * A thread (a route) stays open underneath and reappears when the context drawer closes.
 */
export const useOpenChannelDrawer = (channelID: string) => {
    const setDrawerType = useSetAtom(channelDrawerAtom(channelID))
    const setPollDrawer = useSetAtom(pollDrawerAtom(channelID))
    return useCallback(
        (type: DrawerType) => {
            setDrawerType(type)
            if (type) setPollDrawer(null) // opening (not closing) a context drawer dismisses the poll
        },
        [setDrawerType, setPollDrawer],
    )
}
