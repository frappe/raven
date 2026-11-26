import dayjs from "dayjs"
import { beforeAll, describe, expect, it, vi } from "vitest"
import type { UserData } from "@db"
import {
    formatStatusUntil,
    getDurationEnd,
    getEffectiveStatus,
    getStatusDurations,
    isExpired,
} from "./statusExpiry"

// _() reads window.frappe for translations; tests run in node.
beforeAll(() => vi.stubGlobal("window", {}))

// Wednesday.
const NOW = dayjs("2026-11-25 10:00:00")

const user = (overrides: Partial<UserData> = {}): UserData => ({
    name: "a@example.com",
    full_name: "A",
    enabled: 1,
    type: "User",
    ...overrides,
})

describe("getStatusDurations", () => {
    it("lists the durations in menu order", () => {
        expect(getStatusDurations().map((duration) => duration.id)).toEqual([
            "30m",
            "1h",
            "4h",
            "today",
            "week",
            "custom",
            "never",
        ])
    })
})

describe("getDurationEnd", () => {
    it("adds fixed durations to now", () => {
        expect(getDurationEnd("30m", NOW).isSame(NOW.add(30, "minute"))).toBe(true)
        expect(getDurationEnd("1h", NOW).isSame(NOW.add(1, "hour"))).toBe(true)
        expect(getDurationEnd("4h", NOW).isSame(NOW.add(4, "hour"))).toBe(true)
    })

    it("ends today at the end of the local day, even at 23:50", () => {
        const late = dayjs("2026-11-25 23:50:00")
        const end = getDurationEnd("today", late)
        expect(end.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-11-25 23:59:59")
        expect(end.isAfter(late)).toBe(true)
    })

    it("ends this week at the end of Sunday", () => {
        expect(getDurationEnd("week", NOW).format("YYYY-MM-DD HH:mm:ss")).toBe("2026-11-29 23:59:59")
    })

    it("picked on Sunday, ends this week on that same Sunday", () => {
        const sunday = dayjs("2026-11-29 22:00:00")
        const end = getDurationEnd("week", sunday)
        expect(end.format("YYYY-MM-DD HH:mm:ss")).toBe("2026-11-29 23:59:59")
        expect(end.isAfter(sunday)).toBe(true)
    })
})

describe("formatStatusUntil", () => {
    it("shows the time for an end later today, in the user's time format", () => {
        const end = dayjs("2026-11-25 15:30:00")
        expect(formatStatusUntil(end, "12-hour", NOW)).toBe("Until 3:30 PM")
        expect(formatStatusUntil(end, "24-hour", NOW)).toBe("Until 15:30")
    })

    it("shows the weekday for an end within the next 6 days", () => {
        expect(formatStatusUntil(dayjs("2026-11-28 09:00:00"), "12-hour", NOW)).toBe("Until Sat")
        expect(formatStatusUntil(dayjs("2026-12-01 23:59:59"), "12-hour", NOW)).toBe("Until Tue")
    })

    it("shows the date for an end a week or more away", () => {
        expect(formatStatusUntil(dayjs("2026-12-02 09:00:00"), "12-hour", NOW)).toBe("Until 2 Dec")
        expect(formatStatusUntil(dayjs("2026-12-05 09:00:00"), "12-hour", NOW)).toBe("Until 5 Dec")
    })
})

describe("isExpired", () => {
    const now = "2026-11-26 10:00:00"

    it("treats a missing end time as never expiring", () => {
        expect(isExpired(null, now)).toBe(false)
        expect(isExpired(undefined, now)).toBe(false)
        expect(isExpired("", now)).toBe(false)
    })

    it("expires at and after the end time, like the server sweep", () => {
        expect(isExpired("2026-11-26 09:59:59", now)).toBe(true)
        expect(isExpired("2026-11-26 10:00:00", now)).toBe(true)
        expect(isExpired("2026-11-26 10:00:01", now)).toBe(false)
    })
})

describe("getEffectiveStatus", () => {
    const now = "2026-11-26 10:00:00"

    it("drops an expired availability and its end time", () => {
        const status = getEffectiveStatus(
            user({ availability_status: "Do not disturb", availability_expires_at: "2026-11-26 09:00:00" }),
            now,
        )
        expect(status.availability).toBe("")
        expect(status.availabilityEndsAt).toBeNull()
    })

    it("keeps an unexpired availability with its end time", () => {
        const status = getEffectiveStatus(
            user({ availability_status: "Away", availability_expires_at: "2026-11-26 11:00:00" }),
            now,
        )
        expect(status.availability).toBe("Away")
        expect(status.availabilityEndsAt).toBe("2026-11-26 11:00:00")
    })

    it("drops an expired written status, keeping availability", () => {
        const status = getEffectiveStatus(
            user({
                availability_status: "Away",
                custom_status: "Lunch",
                custom_status_expires_at: "2026-11-26 09:00:00",
            }),
            now,
        )
        expect(status.customStatus).toBe("")
        expect(status.customStatusEndsAt).toBeNull()
        expect(status.availability).toBe("Away")
    })

    it("keeps statuses without an end time", () => {
        const status = getEffectiveStatus(user({ availability_status: "Away", custom_status: "Travelling" }), now)
        expect(status).toEqual({
            availability: "Away",
            availabilityEndsAt: null,
            customStatus: "Travelling",
            customStatusEndsAt: null,
        })
    })
})
