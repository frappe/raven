import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { voicePlaybackStore } from "./store"

/** Any navigation stops voice playback; notes start over when you come back. */
export const useStopVoiceOnNavigate = () => {
    const { pathname } = useLocation()
    useEffect(() => voicePlaybackStore.stopAll(), [pathname])
}
