import { useEffect, useState } from "react"
import { useNavigationType } from "react-router-dom"

/**
 * The `animate-layer-in` class for a mobile page layer — or nothing, when the
 * layer should appear without the slide.
 *
 * Why it exists: going BACK must never animate — the OS back gesture already
 * animates, and a second slide on top looks broken. But the slide-in plays on
 * every fresh mount. So when the user navigates away from a page and comes
 * back to it (a POP), the page remounts with its layer already open and slid
 * in again. This hook leaves the class off in that one case.
 *
 * The class comes back once the layer hides. That happens while the element
 * is display:none, so nothing plays — and the next real open slides as usual.
 */
export const useLayerInAnimation = (visible: boolean): string | undefined => {
    const navigationType = useNavigationType()
    const [armed, setArmed] = useState(() => !(visible && navigationType === "POP"))

    useEffect(() => {
        if (!visible && !armed) setArmed(true)
    }, [visible, armed])

    return armed ? "animate-layer-in" : undefined
}
