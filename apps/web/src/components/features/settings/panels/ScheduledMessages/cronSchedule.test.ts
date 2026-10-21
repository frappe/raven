import { describe, expect, it } from "vitest"
import { fromForm, isValidCron, toForm, type ScheduledMessageForm } from "./cronSchedule"

const base = { event_name: "Daily", bot: "bot", channel: "general", content: "hi" } as ScheduledMessageForm

describe("cronSchedule", () => {
    it("splits a saved expression into time, days and date", () => {
        const form = toForm({ ...base, cron_expression: "5 9 15 * 1,3,5" })
        expect(form).toMatchObject({ time: "09:05", days: ["1", "3", "5"], date: "15", cron: "5 9 15 * 1,3,5" })
    })

    it("leaves the time empty when the expression is not a plain time", () => {
        const form = toForm({ ...base, cron_expression: "*/15 * * * *" })
        expect(form).toMatchObject({ time: "", days: [], date: "1" })
    })

    it("falls back to defaults when there is no expression", () => {
        expect(toForm({ ...base, cron_expression: undefined })).toMatchObject({ time: "", days: [], date: "1", cron: "" })
    })

    it.each([
        ["Every Day", "30 9 * * *"],
        ["Every Day of the week", "30 9 * * 1,3,5"],
        ["Date of the month", "30 9 15 * *"],
    ] as const)("builds the expression for %s", (event_frequency, expected) => {
        const values = { ...base, event_frequency, time: "09:30", days: ["5", "1", "3"], date: "15", cron: "" } as ScheduledMessageForm
        const doc = fromForm(values)
        expect(doc.cron_expression).toBe(expected)
        expect(doc).not.toHaveProperty("time")
        expect(doc).not.toHaveProperty("days")
    })

    it("normalises a custom expression's spacing", () => {
        const doc = fromForm({ ...base, event_frequency: "Cron", time: "", days: [], date: "1", cron: "  30  9 * *   1-5 " } as ScheduledMessageForm)
        expect(doc.cron_expression).toBe("30 9 * * 1-5")
    })

    it("round-trips a weekly schedule", () => {
        const saved = fromForm(toForm({ ...base, event_frequency: "Every Day of the week", cron_expression: "0 8 * * 1,5" }))
        expect(saved.cron_expression).toBe("0 8 * * 1,5")
    })

    it("validates a five-part expression", () => {
        expect(isValidCron("30 9 * * 1-5")).toBe(true)
        expect(isValidCron("30 9 * *")).toBe(false)
        expect(isValidCron("")).toBe(false)
    })
})
