import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    available: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    setAvailable: vi.fn(),
    setOpening: vi.fn(),
    effects: [] as (() => (() => void))[],
}))

vi.mock("@frappe-dev/cloud-sdk", () => ({
    isCloudSettingsAvailable: mocks.available,
    openCloudSettings: mocks.open,
    closeCloudSettings: mocks.close,
}))
vi.mock("react", () => ({
    useEffect: (effect: () => (() => void)) => mocks.effects.push(effect),
    useState: vi.fn(),
}))

import { useState } from "react"
import { useCloudSettings } from "./useCloudSettings"

const RenderCloudSettingsHook = () => {
    vi.mocked(useState)
        .mockReturnValueOnce([false, mocks.setAvailable])
        .mockReturnValueOnce([false, mocks.setOpening])
    return useCloudSettings()
}

beforeEach(() => {
    vi.resetAllMocks()
    mocks.effects.length = 0
    mocks.available.mockResolvedValue(true)
    vi.stubGlobal("window", new EventTarget())
})
afterEach(() => vi.unstubAllGlobals())

describe("Cloud Settings integration", () => {
    it("discovers availability and checks it again when the window regains focus", async () => {
        RenderCloudSettingsHook()
        const cleanup = mocks.effects[0]()
        await vi.waitFor(() => expect(mocks.setAvailable).toHaveBeenCalledWith(true))

        mocks.available.mockResolvedValue(false)
        window.dispatchEvent(new Event("focus"))
        await vi.waitFor(() => expect(mocks.setAvailable).toHaveBeenLastCalledWith(false))
        cleanup()
    })

    it("keeps the entry hidden when discovery fails", async () => {
        mocks.available.mockRejectedValue(new Error("Unavailable"))
        RenderCloudSettingsHook()
        const cleanup = mocks.effects[0]()
        await vi.waitFor(() => expect(mocks.setAvailable).toHaveBeenCalledWith(false))
        cleanup()
    })

    it("does not update an unmounted Rail and closes its dialog", async () => {
        RenderCloudSettingsHook()
        const cleanup = mocks.effects[0]()
        cleanup()
        await Promise.resolve()
        expect(mocks.setAvailable).not.toHaveBeenCalled()
        expect(mocks.close).toHaveBeenCalledOnce()
        window.dispatchEvent(new Event("focus"))
        expect(mocks.available).toHaveBeenCalledOnce()
    })

    it("opens billing with the supported panels and clears the loading state", async () => {
        const hook = RenderCloudSettingsHook()
        await hook.open()
        expect(mocks.open).toHaveBeenCalledWith({
            panels: ["billing", "domains", "advanced"], tab: "billing",
        })
        expect(mocks.setOpening.mock.calls).toEqual([[true], [false]])
    })

    it("allows the caller to show an opening error and clears the loading state", async () => {
        const error = new Error("Network failure")
        mocks.open.mockRejectedValue(error)
        const hook = RenderCloudSettingsHook()
        await expect(hook.open()).rejects.toThrow(error)
        expect(mocks.setOpening).toHaveBeenLastCalledWith(false)
    })
})
