import { useCallback, useContext, useEffect, useRef } from "react"
import { FrappeConfig, FrappeContext } from "frappe-react-sdk"

/** Stop broadcasting after this much keyboard idle. */
const TYPING_IDLE_STOP = 3_000

/**
 * Publishes this user's typing state for a channel. Designed to be driven from
 * the editor's `update` event without EVER re-rendering the composer: all state
 * lives in refs, and onUserType is O(1) per keystroke (one Date.now()).
 *
 * `raven_channel_typing` is emitted once when a burst starts; an idle timer
 * emits `raven_channel_typing_stopped` after 3s with no keystroke, re-arming
 * itself while typing continues (v2 instead hard-stopped every 10s mid-burst,
 * flickering the indicator for everyone else). stopTyping() is the hard stop:
 * send, channel switch, unmount.
 */
export const useTypingEmitter = (channelID: string) => {
    const { socket } = useContext(FrappeContext) as FrappeConfig
    const typingRef = useRef(false)
    const lastTypedRef = useRef(0)
    const timerRef = useRef<number | undefined>(undefined)

    const stopTyping = useCallback(() => {
        window.clearTimeout(timerRef.current)
        if (!typingRef.current) return
        typingRef.current = false
        socket?.emit("raven_channel_typing_stopped", channelID)
    }, [socket, channelID])

    const onUserType = useCallback(() => {
        lastTypedRef.current = Date.now()
        if (typingRef.current) return
        typingRef.current = true
        socket?.emit("raven_channel_typing", channelID)
        const arm = (delay: number) => {
            timerRef.current = window.setTimeout(() => {
                const idle = Date.now() - lastTypedRef.current
                if (idle >= TYPING_IDLE_STOP) stopTyping()
                else arm(TYPING_IDLE_STOP - idle)
            }, delay)
        }
        arm(TYPING_IDLE_STOP)
    }, [socket, channelID, stopTyping])

    // Hard stop on unmount / channel switch (stopTyping's identity changes with the channel).
    useEffect(() => stopTyping, [stopTyping])

    return { onUserType, stopTyping }
}
