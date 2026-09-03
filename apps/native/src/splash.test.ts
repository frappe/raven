import { beforeEach, describe, expect, it, vi } from "vitest"

const hide = vi.fn(async () => { })
vi.mock("@capacitor/splash-screen", () => ({ SplashScreen: { hide: () => hide() } }))

import { armSplashFallback, disarmSplashFallback } from "./splash"

describe("splash fallback", () => {
    beforeEach(() => { vi.useFakeTimers(); hide.mockClear() })

    it("hides the splash once the fallback elapses", () => {
        armSplashFallback(1000)
        vi.advanceTimersByTime(999)
        expect(hide).not.toHaveBeenCalled()
        vi.advanceTimersByTime(1)
        expect(hide).toHaveBeenCalledTimes(1)
    })

    it("does nothing after being disarmed", () => {
        armSplashFallback(1000)
        disarmSplashFallback()
        vi.advanceTimersByTime(2000)
        expect(hide).not.toHaveBeenCalled()
    })

    it("re-arming replaces the earlier timer", () => {
        armSplashFallback(1000)
        armSplashFallback(3000)
        vi.advanceTimersByTime(2000)
        expect(hide).not.toHaveBeenCalled()
        vi.advanceTimersByTime(1000)
        expect(hide).toHaveBeenCalledTimes(1)
    })
})
