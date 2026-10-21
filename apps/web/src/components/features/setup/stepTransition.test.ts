import { describe, expect, it } from "vitest"
import { nextTransition, settleTransition } from "./stepTransition"

describe("step transition", () => {
    it("fades the current step out before showing the next", () => {
        const start = { shown: "profile", phase: "in" as const }
        const out = nextTransition(start, "workspace", false)
        expect(out).toEqual({ shown: "profile", phase: "out", pending: "workspace" })
        expect(settleTransition(out)).toEqual({ shown: "workspace", phase: "in" })
    })

    it("switches at once under reduced motion", () => {
        const start = { shown: "profile", phase: "in" as const }
        expect(nextTransition(start, "workspace", true)).toEqual({ shown: "workspace", phase: "in" })
    })

    it("keeps the same state when the target is already shown", () => {
        const start = { shown: "profile", phase: "in" as const }
        expect(nextTransition(start, "profile", false)).toBe(start)
    })

    it("retargets a fade already in progress", () => {
        const out = { shown: "profile", phase: "out" as const, pending: "workspace" }
        expect(nextTransition(out, "channel", false)).toEqual({ shown: "profile", phase: "out", pending: "channel" })
    })

    it("settling an idle state changes nothing", () => {
        const idle = { shown: "profile", phase: "in" as const }
        expect(settleTransition(idle)).toBe(idle)
    })
})
