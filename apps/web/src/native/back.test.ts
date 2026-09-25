import { describe, expect, it } from "vitest"
import { isRootPath } from "./back"

describe("isRootPath", () => {
    it("treats the footer tabs and a workspace home as roots", () => {
        for (const p of ["/", "/Frappe", "/dm-channel", "/threads", "/notifications", "/profile"]) expect(isRootPath(p)).toBe(true)
    })
    it("keeps single-segment subpages and deeper pages as non-roots", () => {
        for (const p of ["/search", "/saved-messages", "/share-target", "/Frappe/general", "/dm-channel/x", "/settings/profile"]) {
            expect(isRootPath(p)).toBe(false)
        }
    })
})
