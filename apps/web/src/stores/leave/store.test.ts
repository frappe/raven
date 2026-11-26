import { describe, expect, it, vi } from "vitest"
import { DailyUserSetStore } from "./store"

const watch = (store: DailyUserSetStore, ...userIDs: string[]) => {
    const calls: Record<string, ReturnType<typeof vi.fn<() => void>>> = {}
    for (const userID of userIDs) {
        calls[userID] = vi.fn<() => void>()
        store.subscribe(userID, calls[userID])
    }
    return calls
}

describe("DailyUserSetStore", () => {
    it("notifies each user added to the set", () => {
        const store = new DailyUserSetStore()
        const calls = watch(store, "a", "b", "c")
        store.setUsers(["a", "b"])
        expect(calls.a).toHaveBeenCalledTimes(1)
        expect(calls.b).toHaveBeenCalledTimes(1)
        expect(calls.c).not.toHaveBeenCalled()
    })

    it("notifies only users who joined or left on the next list", () => {
        const store = new DailyUserSetStore()
        store.setUsers(["a", "b"])
        const calls = watch(store, "a", "b", "c")
        store.setUsers(["b", "c"])
        expect(calls.a).toHaveBeenCalledTimes(1)
        expect(calls.b).not.toHaveBeenCalled()
        expect(calls.c).toHaveBeenCalledTimes(1)
    })

    it("notifies nobody when the same list arrives again", () => {
        const store = new DailyUserSetStore()
        store.setUsers(["a", "b"])
        const calls = watch(store, "a", "b")
        store.setUsers(["b", "a"])
        expect(calls.a).not.toHaveBeenCalled()
        expect(calls.b).not.toHaveBeenCalled()
    })

    it("has reflects the latest list", () => {
        const store = new DailyUserSetStore()
        store.setUsers(["a", "b"])
        store.setUsers(["b", "c"])
        expect(store.has("a")).toBe(false)
        expect(store.has("b")).toBe(true)
        expect(store.has("c")).toBe(true)
    })

    it("stops notifying after unsubscribe", () => {
        const store = new DailyUserSetStore()
        const listener = vi.fn<() => void>()
        const unsubscribe = store.subscribe("a", listener)
        unsubscribe()
        store.setUsers(["a"])
        expect(listener).not.toHaveBeenCalled()
    })
})
