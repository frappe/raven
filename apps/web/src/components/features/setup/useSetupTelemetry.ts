import { useEffect, useRef } from "react"
import type { SetupStepName, StepStatus } from "./steps"
import { secondsSince, sendSetupEvent } from "./telemetry"

/**
 * Setup's funnel, reported as the Framework wizard reports its own: started, each step
 * completed or skipped with the time spent on it, going back, and leaving before the end.
 */
export const useSetupTelemetry = ({ mode, step, steps }: { mode: "admin" | "profile"; step: SetupStepName; steps: SetupStepName[] }) => {
    const shownAt = useRef<number | null>(null)
    const submitted = useRef(false)

    useEffect(() => {
        sendSetupEvent("started_setup", { mode })
        // Best effort: the event is lost if the page unloads before it is sent.
        const onLeave = () => {
            if (submitted.current) return
            sendSetupEvent("left_setup", { mode, step: stepRef.current, duration_seconds: secondsSince(shownAt.current) }, true)
        }
        window.addEventListener("pagehide", onLeave)
        return () => window.removeEventListener("pagehide", onLeave)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // The step on screen now, for the leave event, and when it was shown, for the durations.
    const stepRef = useRef(step)
    useEffect(() => {
        stepRef.current = step
        shownAt.current = Date.now()
    }, [step])

    const stepProperties = (name: SetupStepName) => ({
        mode,
        step: name,
        step_number: steps.indexOf(name) + 1,
        total_steps: steps.length,
        duration_seconds: secondsSince(shownAt.current),
    })

    return {
        settled: (name: SetupStepName, status: StepStatus) =>
            sendSetupEvent(status === "completed" ? "completed_setup_step" : "skipped_setup_step", stepProperties(name)),
        wentBack: (from: SetupStepName, to: SetupStepName) => sendSetupEvent("went_back_in_setup", { mode, from_step: from, to_step: to }),
        /** Setup is being finished: leaving the page now is not abandoning it. */
        finishing: () => {
            submitted.current = true
        },
    }
}
