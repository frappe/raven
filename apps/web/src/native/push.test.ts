// src/native/push.test.ts
import { describe, expect, it } from "vitest"
import { resolveNotificationTarget } from "./push"

describe("resolveNotificationTarget", () => {
    const origin = "https://a.com"
    it("routes message_url on the same site to a path", () => {
        expect(resolveNotificationTarget({ message_url: "https://a.com/raven/message/M1" }, origin))
            .toEqual({ kind: "same-site", path: "/message/M1" })
    })
    it("keeps search and hash on the same-site path", () => {
        expect(resolveNotificationTarget({ message_url: "https://a.com/raven/ws/ch?x=1#m" }, origin))
            .toEqual({ kind: "same-site", path: "/ws/ch?x=1#m" })
    })
    it("falls back to click_action then base_url", () => {
        expect(resolveNotificationTarget({ click_action: "https://a.com/raven/ws/ch" }, origin))
            .toEqual({ kind: "same-site", path: "/ws/ch" })
        expect(resolveNotificationTarget({ base_url: "https://a.com" }, origin))
            .toEqual({ kind: "same-site", path: "/" })
    })
    it("returns other-site for a different origin", () => {
        expect(resolveNotificationTarget({ message_url: "https://b.com/raven/message/M1" }, origin))
            .toEqual({ kind: "other-site", url: "https://b.com/raven/message/M1" })
    })
    it("returns null with no url", () => {
        expect(resolveNotificationTarget({}, origin)).toBeNull()
    })
})
