import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ call: vi.fn(), supported: vi.fn(), configured: vi.fn(), init: vi.fn() }))
vi.mock("frappe-react-sdk", () => ({ useFrappeGetCall: mocks.call }))
vi.mock("@lib/push", () => ({
    isPushSupportedByBrowser: mocks.supported,
    isRavenPushConfigured: mocks.configured,
    initPushNotifications: mocks.init,
}))
import { useIsPushNotificationEnabled as ReadPushAvailability } from "./useIsPushNotificationEnabled"

beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal("window", { frappe: { boot: { raven_cloud_push_setup_pending: true } } })
    mocks.call.mockReturnValue({ data: undefined })
    mocks.supported.mockReturnValue(true)
    mocks.configured.mockReturnValue(false)
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe("first-login push registration", () => {
    it("checks readiness even when the initial boot has no push configuration", () => {
        expect(ReadPushAvailability()).toBe(false)
        expect(mocks.call.mock.calls[0][2]).toBeUndefined()
        const options = mocks.call.mock.calls[0][3]
        expect(options.refreshInterval(undefined)).toBe(5000)
    })

    it("updates boot after registration and stops polling", () => {
        ReadPushAvailability()
        const options = mocks.call.mock.calls[0][3]
        const message = { firebase_client_config: '{"projectId":"test"}', vapid_public_key: "public" }
        options.onSuccess({ message })
        expect(window.frappe.boot).toMatchObject({ ...message, raven_cloud_push_setup_pending: false })
        expect(mocks.init).toHaveBeenCalledOnce()
        expect(options.refreshInterval({ message })).toBe(0)
        mocks.call.mockReturnValue({ data: { message } })
        expect(ReadPushAvailability()).toBe(true)
    })

    it("stops checking after a minute while setup keeps failing", () => {
        ReadPushAvailability()
        const options = mocks.call.mock.calls[0][3]
        vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61_000)
        expect(options.refreshInterval(undefined)).toBe(0)
    })

    it("does not check a browser without push support or a site without setup", () => {
        mocks.supported.mockReturnValue(false)
        ReadPushAvailability()
        expect(mocks.call.mock.calls[0][2]).toBeNull()
        mocks.supported.mockReturnValue(true)
        window.frappe.boot.raven_cloud_push_setup_pending = false
        ReadPushAvailability()
        expect(mocks.call.mock.calls[1][2]).toBeNull()
    })
})
