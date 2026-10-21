import { useEffect, useState } from "react"
import { nextTransition, settleTransition, type StepTransition } from "./stepTransition"

const OUT_MS = 200

export const prefersReducedMotion = () =>
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true

/** The step to render while `target` changes: the old one stays for its fade-out. */
export const useStepTransition = <T,>(target: T): { shown: T; phase: "in" | "out" } => {
    const [state, setState] = useState<StepTransition<T>>({ shown: target, phase: "in" })
    // Started during render, so a new step never renders a frame with the old phase.
    const [lastTarget, setLastTarget] = useState(target)
    if (lastTarget !== target) {
        setLastTarget(target)
        setState(nextTransition(state, target, prefersReducedMotion()))
    }

    useEffect(() => {
        if (state.phase !== "out") return
        const timer = window.setTimeout(() => setState(settleTransition), OUT_MS)
        return () => window.clearTimeout(timer)
    }, [state])

    return { shown: state.shown, phase: state.phase }
}
