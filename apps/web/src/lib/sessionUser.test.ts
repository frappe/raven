import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { clearSessionUser, isLoggedIn, sessionUser, setSessionUser } from "./sessionUser"

// js-cookie reads document.cookie as a string; a plain object is enough in node.
beforeEach(() => { (globalThis as any).document = { cookie: "" } })
afterEach(() => { clearSessionUser(); delete (globalThis as any).document })

describe("sessionUser", () => {
    it("reads the Frappe cookies in the browser", () => {
        document.cookie = "user_id=alice%40x.com; full_name=Alice"
        expect(sessionUser()).toEqual({ name: "alice@x.com", fullName: "Alice", image: "" })
        expect(isLoggedIn()).toBe(true)
    })
    it("treats Guest and no cookie as logged out", () => {
        expect(isLoggedIn()).toBe(false)
        document.cookie = "user_id=Guest"
        expect(isLoggedIn()).toBe(false)
    })
    it("prefers the user set by native boot", () => {
        setSessionUser({ name: "bob@x.com", fullName: "Bob", image: "/files/bob.png" })
        expect(sessionUser().name).toBe("bob@x.com")
        expect(isLoggedIn()).toBe(true)
    })
})
