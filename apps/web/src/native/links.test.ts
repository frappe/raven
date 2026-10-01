import { describe, expect, it, vi } from "vitest"

vi.mock("@lib/site", () => ({ siteOrigin: () => "https://a.com", siteBaseName: () => "raven" }))

import { inAppPath } from "./links"

describe("inAppPath", () => {
    const origin = "https://a.com"
    it("maps the site's Raven links to in-app paths", () => {
        expect(inAppPath("https://a.com/raven/Frappe/x?y=1#z", origin, "raven")).toBe("/Frappe/x?y=1#z")
        expect(inAppPath("https://a.com/raven", origin, "raven")).toBe("/")
        expect(inAppPath("/raven/dm-channel/a", origin, "raven")).toBe("/dm-channel/a")
    })
    it("leaves the desk, other paths, and other origins alone", () => {
        expect(inAppPath("https://a.com/app/todo", origin, "raven")).toBeNull()
        expect(inAppPath("https://a.com/ravenous", origin, "raven")).toBeNull()
        expect(inAppPath("https://b.com/raven/Frappe/x", origin, "raven")).toBeNull()
        expect(inAppPath("mailto:x@y.z", origin, "raven")).toBeNull()
    })
})
