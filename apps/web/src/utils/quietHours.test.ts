import { beforeEach, describe, expect, it, vi } from "vitest"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"
import { getQuietHoursConfig } from "./preferences"
import { isInQuietHoursAt } from "./quietHours"

dayjs.extend(utc)
dayjs.extend(timezone)

vi.mock("@lib/date", () => ({ SYSTEM_TIMEZONE: "UTC" }))
vi.mock("./preferences", () => ({ getQuietHoursConfig: vi.fn() }))

const at = (hm: string) => dayjs.utc(`2026-11-20T${hm}:00Z`)

const setHours = (start: string, end: string) =>
    vi.mocked(getQuietHoursConfig).mockReturnValue({ working_hours_start: start, working_hours_end: end })

describe("isInQuietHoursAt", () => {
    beforeEach(() => setHours("09:00:00", "18:00:00"))

    it("is quiet outside a normal working window", () => {
        expect(isInQuietHoursAt(at("10:00"))).toBe(false)
        // Working hours end at 18:00 itself.
        expect(isInQuietHoursAt(at("18:00"))).toBe(true)
        expect(isInQuietHoursAt(at("08:59"))).toBe(true)
    })

    it("handles a window that wraps midnight", () => {
        setHours("22:00:00", "06:00:00")
        expect(isInQuietHoursAt(at("23:00"))).toBe(false)
        expect(isInQuietHoursAt(at("12:00"))).toBe(true)
    })
})
