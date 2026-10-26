import { useCallback, useEffect, useState } from "react"
import { getCurrentPosition, type FixError, type PositionFix } from "../../../../native/geolocation"

export type LocationFixState = "locating" | "ready" | FixError

export type LocationFix = {
    state: LocationFixState
    fix?: PositionFix
    retry: () => void
}

/** The device fix, re-requested by `retry`; a result landing after unmount is dropped. */
export const useLocationFix = (): LocationFix => {
    const [state, setState] = useState<LocationFixState>("locating")
    const [fix, setFix] = useState<PositionFix>()
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let cancelled = false
        setState("locating")
        setFix(undefined)
        getCurrentPosition().then((result) => {
            if (cancelled) return
            if ("fix" in result) {
                setFix(result.fix)
                setState("ready")
            } else {
                setState(result.error)
            }
        })
        return () => {
            cancelled = true
        }
    }, [attempt])

    const retry = useCallback(() => setAttempt((count) => count + 1), [])
    return { state, fix, retry }
}
