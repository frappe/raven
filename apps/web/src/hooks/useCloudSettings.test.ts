import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getDefaultStore } from "jotai"

const sdk = vi.hoisted(() => ({ open: vi.fn(), close: vi.fn() }))
vi.mock("@frappe-dev/cloud-sdk", () => ({
    openCloudSettings: sdk.open,
    closeCloudSettings: sdk.close,
}))

import { cloudSettingsOpenAtom, isCloudSettingsAvailable, openBillingDialog } from "./useCloudSettings"

const store = getDefaultStore()

beforeEach(() => {
    vi.resetAllMocks()
    sdk.open.mockResolvedValue(undefined)
    store.set(cloudSettingsOpenAtom, false)
    vi.stubGlobal("window", { frappe: { boot: { cloud_settings: { enabled: true } } } })
})

afterEach(() => vi.unstubAllGlobals())

describe("isCloudSettingsAvailable", () => {
    it("reads the boot flag Frappe sets on a pilot-managed site", () => {
        expect(isCloudSettingsAvailable()).toBe(true)
        window.frappe.boot.cloud_settings.enabled = false
        expect(isCloudSettingsAvailable()).toBe(false)
    })

    it("is false on a Frappe version that has no cloud_settings in boot", () => {
        delete window.frappe.boot.cloud_settings
        expect(isCloudSettingsAvailable()).toBe(false)
    })
})

describe("openBillingDialog", () => {
    it("opens on the billing panel and holds the Esc gate until the dialog closes", async () => {
        await openBillingDialog()
        expect(sdk.open).toHaveBeenCalledOnce()
        const options = sdk.open.mock.calls[0][0]
        expect(options).toMatchObject({ panels: ["billing", "domains", "advanced"], tab: "billing" })
        expect(store.get(cloudSettingsOpenAtom)).toBe(true)
        options.onClose()
        expect(store.get(cloudSettingsOpenAtom)).toBe(false)
    })

    it("releases the Esc gate and rethrows when the dialog fails to open", async () => {
        const error = new Error("Could not reach Cloud Settings")
        sdk.open.mockRejectedValue(error)
        await expect(openBillingDialog()).rejects.toThrow(error)
        expect(store.get(cloudSettingsOpenAtom)).toBe(false)
    })
})
