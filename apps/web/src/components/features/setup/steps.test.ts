import { describe, expect, it } from "vitest"
import { getSetupSteps } from "./steps"

describe("getSetupSteps", () => {
    it("starts the admin flow with the profile, then the workspace and channel before the team", () => {
        expect(getSetupSteps({ mode: "admin", hasTeamStep: true, hrInstalled: false })).toEqual(["profile", "workspace", "channel", "team"])
    })

    it("adds the HR step last when Frappe HR is installed", () => {
        expect(getSetupSteps({ mode: "admin", hasTeamStep: true, hrInstalled: true })).toEqual(["profile", "workspace", "channel", "team", "hr"])
    })

    it("drops the team step when there's no one to add or invite", () => {
        expect(getSetupSteps({ mode: "admin", hasTeamStep: false, hrInstalled: false })).toEqual(["profile", "workspace", "channel"])
    })

    it("asks members for their profile only", () => {
        expect(getSetupSteps({ mode: "profile", hasTeamStep: true, hrInstalled: true })).toEqual(["profile"])
    })
})
