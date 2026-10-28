import { afterEach, describe, expect, it, vi } from "vitest"

const HIGH_ACCURACY = { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
const LOW_ACCURACY = { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }

const position = (accuracy: number) => ({
    coords: { latitude: 12.9716, longitude: 77.5946, accuracy },
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.doUnmock("@capacitor/geolocation")
    vi.resetModules()
})

const webModule = async (getCurrentPosition: ReturnType<typeof vi.fn>) => {
    vi.stubGlobal("window", {})
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } })
    vi.resetModules()
    return import("./geolocation")
}

type NativeMocks = {
    requestPermissions?: ReturnType<typeof vi.fn>
    getCurrentPosition?: ReturnType<typeof vi.fn>
}

const nativeModule = async (mocks: NativeMocks = {}) => {
    const requestPermissions = mocks.requestPermissions ?? vi.fn(async () => ({ location: "granted" }))
    const getCurrentPosition = mocks.getCurrentPosition ?? vi.fn(async () => position(5))
    vi.stubGlobal("window", { Capacitor: { isNativePlatform: () => true } })
    vi.doMock("@capacitor/geolocation", () => ({
        Geolocation: { requestPermissions, getCurrentPosition },
    }))
    vi.resetModules()
    const { getCurrentPosition: currentPosition } = await import("./geolocation")
    return { currentPosition, requestPermissions, getCurrentPosition }
}

describe("web geolocation", () => {
    it("returns the fix on success", async () => {
        const getCurrentPosition = vi.fn((success) => success(position(12)))
        const { getCurrentPosition: currentPosition } = await webModule(getCurrentPosition)

        await expect(currentPosition()).resolves.toEqual({
            fix: { latitude: 12.9716, longitude: 77.5946, accuracy: 12 },
        })
        expect(getCurrentPosition).toHaveBeenCalledTimes(1)
        expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), HIGH_ACCURACY)
    })

    it("does not retry when permission is denied", async () => {
        const getCurrentPosition = vi.fn((_success, error) => error({ code: 1 }))
        const { getCurrentPosition: currentPosition } = await webModule(getCurrentPosition)

        await expect(currentPosition()).resolves.toEqual({ error: "denied" })
        expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    })

    it("retries a timeout with low accuracy and returns that fix", async () => {
        const getCurrentPosition = vi.fn((success, error, options) => {
            if (options.enableHighAccuracy) error({ code: 3 })
            else success(position(250))
        })
        const { getCurrentPosition: currentPosition } = await webModule(getCurrentPosition)

        await expect(currentPosition()).resolves.toEqual({
            fix: { latitude: 12.9716, longitude: 77.5946, accuracy: 250 },
        })
        expect(getCurrentPosition).toHaveBeenCalledTimes(2)
        expect(getCurrentPosition.mock.calls[1][2]).toEqual(LOW_ACCURACY)
    })

    it("returns unavailable when both attempts fail", async () => {
        const getCurrentPosition = vi.fn((_success, error, _options) => error({ code: 2 }))
        const { getCurrentPosition: currentPosition } = await webModule(getCurrentPosition)

        await expect(currentPosition()).resolves.toEqual({ error: "unavailable" })
        expect(getCurrentPosition).toHaveBeenCalledTimes(2)
        expect(getCurrentPosition.mock.calls[1][2]).toEqual(LOW_ACCURACY)
    })

    it("returns unavailable without the geolocation API", async () => {
        vi.stubGlobal("window", {})
        vi.stubGlobal("navigator", {})
        vi.resetModules()
        const { getCurrentPosition } = await import("./geolocation")

        await expect(getCurrentPosition()).resolves.toEqual({ error: "unavailable" })
    })

    it("times out at 30s and ignores a late callback", async () => {
        vi.useFakeTimers()
        let succeed: ((fix: ReturnType<typeof position>) => void) | undefined
        const getCurrentPosition = vi.fn((success) => {
            succeed = success
        })
        const { getCurrentPosition: currentPosition } = await webModule(getCurrentPosition)

        const result = currentPosition()
        await vi.advanceTimersByTimeAsync(30000)

        await expect(result).resolves.toEqual({ error: "timeout" })
        expect(vi.getTimerCount()).toBe(0)

        succeed?.(position(8))
        await vi.advanceTimersByTimeAsync(0)

        await expect(result).resolves.toEqual({ error: "timeout" })
        expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    })
})

describe("native geolocation", () => {
    it("returns denied when the permission prompt is denied", async () => {
        const requestPermissions = vi.fn(async () => ({ location: "denied", coarseLocation: "denied" }))
        const { currentPosition, getCurrentPosition } = await nativeModule({ requestPermissions })

        await expect(currentPosition()).resolves.toEqual({ error: "denied" })
        expect(getCurrentPosition).not.toHaveBeenCalled()
    })

    it("asks for a coarse fix when Android grants approximate only", async () => {
        const requestPermissions = vi.fn(async () => ({ location: "denied", coarseLocation: "granted" }))
        const { currentPosition, getCurrentPosition } = await nativeModule({ requestPermissions })

        await expect(currentPosition()).resolves.toEqual({
            fix: { latitude: 12.9716, longitude: 77.5946, accuracy: 5 },
        })
        expect(getCurrentPosition).toHaveBeenCalledTimes(1)
        expect(getCurrentPosition.mock.calls[0][0]).toEqual(LOW_ACCURACY)
    })

    it("maps an OS-PLUG-GLOC-0007 error to denied", async () => {
        const getCurrentPosition = vi.fn().mockRejectedValue({ code: "OS-PLUG-GLOC-0007" })
        const { currentPosition } = await nativeModule({ getCurrentPosition })

        await expect(currentPosition()).resolves.toEqual({ error: "denied" })
        expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    })

    it("maps an OS-PLUG-GLOC-0003 error to denied", async () => {
        const getCurrentPosition = vi.fn(async () => {
            throw { code: "OS-PLUG-GLOC-0003" }
        })
        const { currentPosition } = await nativeModule({ getCurrentPosition })

        await expect(currentPosition()).resolves.toEqual({ error: "denied" })
        expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    })

    it("retries an OS-PLUG-GLOC-0010 timeout with low accuracy", async () => {
        const getCurrentPosition = vi
            .fn()
            .mockRejectedValueOnce({ code: "OS-PLUG-GLOC-0010" })
            .mockResolvedValueOnce(position(180))
        const { currentPosition } = await nativeModule({ getCurrentPosition })

        await expect(currentPosition()).resolves.toEqual({
            fix: { latitude: 12.9716, longitude: 77.5946, accuracy: 180 },
        })
        expect(getCurrentPosition).toHaveBeenCalledTimes(2)
        expect(getCurrentPosition.mock.calls[1][0]).toEqual(LOW_ACCURACY)
    })

    it("returns unavailable when both attempts fail", async () => {
        const getCurrentPosition = vi.fn().mockRejectedValue({ code: "OS-PLUG-GLOC-0001" })
        const { currentPosition } = await nativeModule({ getCurrentPosition })

        await expect(currentPosition()).resolves.toEqual({ error: "unavailable" })
        expect(getCurrentPosition).toHaveBeenCalledTimes(2)
    })

    it("returns unavailable for an unknown error", async () => {
        const getCurrentPosition = vi.fn().mockRejectedValue(new Error("boom"))
        const { currentPosition } = await nativeModule({ getCurrentPosition })

        await expect(currentPosition()).resolves.toEqual({ error: "unavailable" })
    })

    it("maps a message-only OS-PLUG-GLOC-0008 error to denied", async () => {
        const getCurrentPosition = vi.fn(async () => {
            throw { message: "Location permission failed: OS-PLUG-GLOC-0008" }
        })
        const { currentPosition } = await nativeModule({ getCurrentPosition })

        await expect(currentPosition()).resolves.toEqual({ error: "denied" })
        expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    })

    it("times out at 30s while the permission prompt is open", async () => {
        vi.useFakeTimers()
        const requestPermissions = vi.fn(() => new Promise(() => { }))
        const { currentPosition, getCurrentPosition } = await nativeModule({ requestPermissions })

        const result = currentPosition()
        await vi.advanceTimersByTimeAsync(30000)

        await expect(result).resolves.toEqual({ error: "timeout" })
        expect(getCurrentPosition).not.toHaveBeenCalled()
    })
})
