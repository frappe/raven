import dayjs from "dayjs"
import { beforeAll, describe, expect, it, vi } from "vitest"
import type { UserData } from "@db"
import { getStatusFormValues, getStatusPayload } from "./statusForm"

beforeAll(() => vi.stubGlobal("window", {}))

const NOW_SERVER = "2026-11-26 10:00:00"
const NOW = dayjs.tz(NOW_SERVER, "Asia/Kolkata")

const user = (overrides: Partial<UserData> = {}): UserData => ({
    name: "a@example.com",
    full_name: "A",
    enabled: 1,
    type: "User",
    ...overrides,
})

describe("getStatusFormValues", () => {
    it("keeps a timed status's end as the current choice", () => {
        const seed = getStatusFormValues(
            user({ custom_status: "Out sick", custom_status_expires_at: "2026-11-28 18:00:00" }),
            NOW_SERVER,
        )
        expect(seed.custom_status).toBe("Out sick")
        expect(seed.clear_after).toBe("at")
        expect(seed.clear_after_at).toBe("2026-11-28 18:00:00")
    })

    it("seeds an untimed status as don't clear", () => {
        const seed = getStatusFormValues(user({ custom_status: "Travelling" }), NOW_SERVER)
        expect(seed.clear_after).toBe("never")
        expect(seed.clear_after_at).toBeNull()
    })

    it("seeds an expired status and availability as cleared", () => {
        const seed = getStatusFormValues(
            user({
                availability_status: "Do not disturb",
                availability_expires_at: "2026-11-26 09:00:00",
                custom_status: "Lunch",
                custom_status_expires_at: "2026-11-26 09:00:00",
            }),
            NOW_SERVER,
        )
        expect(seed.availability_status).toBe("")
        expect(seed.availability_expires_at).toBeNull()
        expect(seed.custom_status).toBe("")
        expect(seed.clear_after).toBe("never")
    })
})

describe("getStatusPayload", () => {
    const seed = getStatusFormValues(
        user({
            availability_status: "Away",
            availability_expires_at: "2026-11-26 12:00:00",
            custom_status: "Out sick",
            custom_status_expires_at: "2026-11-28 18:00:00",
        }),
        NOW_SERVER,
    )

    it("resends unchanged values with their stored end times", () => {
        expect(getStatusPayload(seed, seed.availability_status, NOW)).toEqual({
            availability_status: "Away",
            availability_expires_at: "2026-11-26 12:00:00",
            custom_status: "Out sick",
            custom_status_expires_at: "2026-11-28 18:00:00",
        })
    })

    it("drops the availability end when availability changes here", () => {
        const payload = getStatusPayload({ ...seed, availability_status: "Do not disturb" }, seed.availability_status, NOW)
        expect(payload.availability_expires_at).toBeNull()
    })

    it("resolves a duration from now", () => {
        const payload = getStatusPayload({ ...seed, clear_after: "1h" }, seed.availability_status, NOW)
        expect(payload.custom_status_expires_at).toBe("2026-11-26 11:00:00")
    })

    it("sends no end for don't clear, an empty status, or an unfinished date pick", () => {
        expect(getStatusPayload({ ...seed, clear_after: "never" }, seed.availability_status, NOW).custom_status_expires_at).toBeNull()
        expect(getStatusPayload({ ...seed, custom_status: "  " }, seed.availability_status, NOW).custom_status_expires_at).toBeNull()
        expect(getStatusPayload({ ...seed, clear_after: "custom" }, seed.availability_status, NOW).custom_status_expires_at).toBeNull()
    })
})
