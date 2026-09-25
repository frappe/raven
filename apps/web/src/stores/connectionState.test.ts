import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isOnline, setSiteReachable, subscribeOnline } from "./connectionState"

describe("setSiteReachable", () => {
    beforeEach(() => { vi.useFakeTimers(); setSiteReachable(true) })
    afterEach(() => vi.useRealTimers())
    it("goes offline 5 s after the site stops answering, and back at once", () => {
        const seen: boolean[] = []
        const unsubscribe = subscribeOnline(() => seen.push(isOnline()))
        setSiteReachable(false)
        expect(isOnline()).toBe(true)
        vi.advanceTimersByTime(5000)
        expect(isOnline()).toBe(false)
        setSiteReachable(true)
        expect(isOnline()).toBe(true)
        expect(seen).toEqual([false, true])
        unsubscribe()
    })
    it("reports the end of an outage once", () => {
        setSiteReachable(false)
        vi.advanceTimersByTime(5000)
        expect(setSiteReachable(true)).toBe(true)
        expect(setSiteReachable(true)).toBe(false)
    })
    it("drops a pending outage when the site answers in time", () => {
        setSiteReachable(false)
        vi.advanceTimersByTime(2000)
        setSiteReachable(true)
        vi.advanceTimersByTime(5000)
        expect(isOnline()).toBe(true)
    })
})
