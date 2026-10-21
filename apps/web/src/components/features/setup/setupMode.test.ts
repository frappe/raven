import { describe, expect, it } from "vitest"
import { getSetupMode } from "./setupMode"

describe("getSetupMode", () => {
    it("runs the admin flow while site setup is pending, onboarded or not", () => {
        expect(getSetupMode({ setupPending: true, onboarded: false })).toBe("admin")
        expect(getSetupMode({ setupPending: true, onboarded: true })).toBe("admin")
    })

    it("asks anyone not onboarded for their profile", () => {
        expect(getSetupMode({ setupPending: false, onboarded: false })).toBe("profile")
    })

    it("opens nothing once setup is done and the user is onboarded", () => {
        expect(getSetupMode({ setupPending: false, onboarded: true })).toBeNull()
    })
})
