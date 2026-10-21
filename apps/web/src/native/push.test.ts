import { describe, expect, it, vi } from "vitest"
import { siteFetch } from "@lib/site"
import { resolveNotificationTarget, syncToken, trayChannelId } from "./push"

vi.mock("@lib/site", () => ({ siteFetch: vi.fn(), siteKey: (k: string) => k, siteOrigin: () => "https://a.com" }))
vi.mock("@capacitor/preferences", () => ({ Preferences: { set: async () => { }, remove: async () => { } } }))

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
    it("rejects non-web schemes", () => {
        expect(resolveNotificationTarget({ message_url: "javascript:alert(1)" }, origin)).toBeNull()
    })
    it("returns null with no url", () => {
        expect(resolveNotificationTarget({}, origin)).toBeNull()
    })
})

describe("trayChannelId", () => {
    it("strips this site's prefix from an Android tag", () => {
        expect(trayChannelId("a.com:general", {}, "a.com")).toBe("general")
    })
    it("ignores another site's tag", () => {
        expect(trayChannelId("b.com:general", {}, "a.com")).toBeUndefined()
    })
    it("uses the payload's channel id when there is no tag (iOS), only for this site", () => {
        expect(trayChannelId(null, { channel_id: "general", base_url: "https://a.com" }, "a.com")).toBe("general")
        expect(trayChannelId(null, { channel_id: "general", base_url: "https://b.com" }, "a.com")).toBeUndefined()
        expect(trayChannelId(undefined, { channel_id: "general" }, "a.com")).toBeUndefined()
    })
})

describe("syncToken", () => {
    it("keeps syncing after a failed subscribe", async () => {
        const store = new Map<string, string>()
        vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) })
        vi.mocked(siteFetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response).mockResolvedValue({ ok: true } as Response)
        await expect(syncToken("t1")).rejects.toThrow()
        await expect(syncToken("t2")).resolves.toBeUndefined()
        expect(store.get("raven-native-fcm-token")).toBe("t2")
    })
})
