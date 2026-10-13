import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { trackOverlay } from "./useHistoryBackClose"

/** A browser history whose back() finishes after `backDelay` ms, like a slow browser. */
class FakeHistory {
    entries: unknown[] = [{ idx: 0 }]
    index = 0
    backDelay = 0
    listeners = new Set<() => void>()

    get state() {
        return this.entries[this.index]
    }

    pushState(state: unknown) {
        this.entries = [...this.entries.slice(0, this.index + 1), state]
        this.index++
    }

    back() {
        setTimeout(() => {
            this.index--
            this.listeners.forEach((listener) => listener())
        }, this.backDelay)
    }
}

let history: FakeHistory

beforeEach(() => {
    vi.useFakeTimers()
    history = new FakeHistory()
    const listeners = history.listeners
    vi.stubGlobal("window", {
        history,
        setTimeout,
        clearTimeout,
        addEventListener: (_type: string, listener: () => void, options?: { once?: boolean }) => {
            if (!options?.once) return listeners.add(listener)
            const once = () => {
                listeners.delete(once)
                listener()
            }
            listeners.add(once)
        },
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    })
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

describe("trackOverlay", () => {
    it("closes the overlay when the user presses back", async () => {
        const onBack = vi.fn()
        trackOverlay(onBack)
        await vi.advanceTimersByTimeAsync(0)
        history.back()
        await vi.advanceTimersByTimeAsync(0)
        expect(onBack).toHaveBeenCalledOnce()
    })

    it("removes its entry when the overlay closes from the UI", async () => {
        const close = trackOverlay(vi.fn())
        await vi.advanceTimersByTimeAsync(0)
        expect(history.index).toBe(1)
        close()
        await vi.advanceTimersByTimeAsync(0)
        expect(history.index).toBe(0)
    })

    it("keeps a sheet open when it opens as another closes, and the back is slow", async () => {
        history.backDelay = 50
        const closeComposerSheet = trackOverlay(vi.fn())
        await vi.advanceTimersByTimeAsync(0)

        closeComposerSheet()
        const onPollBack = vi.fn()
        trackOverlay(onPollBack)
        await vi.advanceTimersByTimeAsync(100)

        expect(onPollBack).not.toHaveBeenCalled()
        expect(history.index).toBe(1)
        expect(history.state).toMatchObject({ idx: 0, ravenOverlays: [expect.any(Number)] })
    })

    it("closes only the top sheet of a stack on back", async () => {
        const onParentBack = vi.fn()
        const onChildBack = vi.fn()
        trackOverlay(onParentBack)
        await vi.advanceTimersByTimeAsync(0)
        trackOverlay(onChildBack)
        await vi.advanceTimersByTimeAsync(0)

        history.back()
        await vi.advanceTimersByTimeAsync(0)
        expect(onChildBack).toHaveBeenCalledOnce()
        expect(onParentBack).not.toHaveBeenCalled()
    })
})
