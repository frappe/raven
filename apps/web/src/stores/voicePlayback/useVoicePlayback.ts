import { useCallback, useSyncExternalStore } from "react"
import { voicePlaybackStore } from "./store"
import type { NotePlayback } from "./reducers"

/** This note's playback state; re-renders only when this note changes. */
export const useVoicePlayback = (id: string): NotePlayback => {
    const subscribe = useCallback((listener: () => void) => voicePlaybackStore.subscribe(id, listener), [id])
    return useSyncExternalStore(subscribe, () => voicePlaybackStore.getSnapshot(id))
}
