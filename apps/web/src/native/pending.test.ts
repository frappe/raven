import { beforeEach, describe, expect, it, vi } from "vitest"
import { pending, pendingNotice, pendingPath } from "./pending"

const { prefs } = vi.hoisted(() => ({ prefs: new Map<string, string>() }))
vi.mock("@capacitor/preferences", () => ({
    Preferences: {
        get: async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null }),
        set: async ({ key, value }: { key: string; value: string }) => { prefs.set(key, value) },
        remove: async ({ key }: { key: string }) => { prefs.delete(key) },
        then: () => { throw new Error("Preferences.then() is not implemented") },
    },
}))

describe("pending values", () => {
    beforeEach(() => prefs.clear())
    it("peek reads the value and leaves it for the take that follows", async () => {
        await pendingPath.set("/share-target?native=1")
        expect(await pendingPath.peek()).toBe("/share-target?native=1")
        expect(await pendingPath.peek()).toBe("/share-target?native=1")
        expect(await pendingPath.take()).toBe("/share-target?native=1")
        expect(await pendingPath.peek()).toBeNull()
    })
    it("takes a value once", async () => {
        await pendingPath.set("/x")
        expect(await pendingPath.take()).toBe("/x")
        expect(await pendingPath.take()).toBeNull()
    })
    it("keeps keys apart", async () => {
        await pendingNotice.set("hello")
        expect(await pending("pendingPath").take()).toBeNull()
        expect(await pendingNotice.take()).toBe("hello")
    })
})
