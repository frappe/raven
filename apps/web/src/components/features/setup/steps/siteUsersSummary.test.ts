import { beforeAll, describe, expect, it, vi } from "vitest"
import { siteUsersSummary } from "./siteUsersSummary"

// The translate helper reads window.frappe; without it the text comes back as written.
beforeAll(() => vi.stubGlobal("window", {}))

const user = (full_name: string) => ({ user: `${full_name.toLowerCase().replace(" ", ".")}@example.com`, full_name })

describe("siteUsersSummary", () => {
    it("names two people", () => {
        expect(siteUsersSummary([user("Alex Rivera"), user("Sam Lee")])).toBe("Alex and Sam are already on this site")
    })

    it("names three, and counts from four", () => {
        expect(siteUsersSummary([user("Alex R"), user("Sam L"), user("Jordan P")])).toBe("Alex, Sam and Jordan are already on this site")
        expect(siteUsersSummary([user("Alex R"), user("Sam L"), user("Jordan P"), user("Taylor M"), user("Morgan T")])).toBe("Alex, Sam and 3 others are already on this site")
    })

    it("falls back to the email when there's no name", () => {
        expect(siteUsersSummary([{ user: "a@example.com", full_name: "" }, user("Sam Lee")])).toBe("a@example.com and Sam are already on this site")
    })
})
