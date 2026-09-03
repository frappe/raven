import { describe, expect, it } from "vitest"
import { loginRedirectUrl, logoutRedirectUrl } from "./session"

describe("logoutRedirectUrl", () => {
    it("native → shell signout with the site origin", () => {
        expect(logoutRedirectUrl(true, "https://a.com", "capacitor://localhost", "/raven"))
            .toBe("capacitor://localhost/?signout=https%3A%2F%2Fa.com")
    })
    it("web → frappe login with app path", () => {
        expect(logoutRedirectUrl(false, "https://a.com", "capacitor://localhost", "/raven")).toBe("/login?redirect-to=%2Fraven")
    })
})

describe("loginRedirectUrl", () => {
    it("web → frappe login", () => {
        expect(loginRedirectUrl("/raven/ws/x", false, "https://a.com", "capacitor://localhost")).toBe("/login?redirect-to=%2Fraven%2Fws%2Fx")
    })
    it("native → shell relogin with site and path", () => {
        expect(loginRedirectUrl("/raven/ws/x", true, "https://a.com", "capacitor://localhost"))
            .toBe("capacitor://localhost/?relogin=https%3A%2F%2Fa.com&to=%2Fraven%2Fws%2Fx")
    })
})
