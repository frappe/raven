import { beforeAll, describe, expect, it, vi } from "vitest"
import { coerceValues, describeField, requiredRule, seedDefaults } from "./messageActionFields"
import type { RavenMessageActionFields } from "@raven/types/RavenIntegrations/RavenMessageActionFields"

beforeAll(() => {
    vi.stubGlobal("window", {
        frappe: {
            _messages: {},
        },
    })
})

const row = (overrides: Partial<RavenMessageActionFields>): RavenMessageActionFields =>
    ({
        fieldname: "field_a",
        label: "Field A",
        type: "Data",
        ...overrides,
    }) as RavenMessageActionFields

describe("describeField", () => {
    it("maps Small Text", () => {
        expect(describeField(row({ type: "Small Text" }))).toEqual({ kind: "small-text" })
    })

    it("maps Select with newline-separated choices, trimming blanks", () => {
        expect(describeField(row({ type: "Select", options: "Open\nClosed\n\n Working " }))).toEqual({
            kind: "select",
            choices: ["Open", "Closed", "Working"],
        })
    })

    it("maps Link with the target doctype from options", () => {
        expect(describeField(row({ type: "Link", options: " ToDo " }))).toEqual({ kind: "link", doctype: "ToDo" })
    })

    it("maps Date and Checkbox", () => {
        expect(describeField(row({ type: "Date" }))).toEqual({ kind: "date" })
        expect(describeField(row({ type: "Checkbox" }))).toEqual({ kind: "checkbox" })
    })

    it("maps Number, Time, Datetime onto typed data inputs", () => {
        expect(describeField(row({ type: "Number" }))).toEqual({ kind: "data", inputType: "number" })
        expect(describeField(row({ type: "Time" }))).toEqual({ kind: "data", inputType: "time" })
        expect(describeField(row({ type: "Datetime" }))).toEqual({ kind: "data", inputType: "datetime-local" })
    })

    it("maps Data using options as the input type only when it is a valid one", () => {
        expect(describeField(row({ type: "Data", options: "email" }))).toEqual({ kind: "data", inputType: "email" })
        expect(describeField(row({ type: "Data", options: "not-a-type" }))).toEqual({ kind: "data", inputType: "text" })
        expect(describeField(row({ type: "Data" }))).toEqual({ kind: "data", inputType: "text" })
    })

    it("falls back to a text input for an unknown future type", () => {
        expect(describeField(row({ type: "Rating" as RavenMessageActionFields["type"] }))).toEqual({
            kind: "data",
            inputType: "text",
        })
    })
})

describe("requiredRule", () => {
    it("builds the message from the label when required", () => {
        expect(requiredRule(row({ is_required: 1, label: "Due Date" }))).toEqual({ required: "Due Date is required" })
    })

    it("is undefined when not required", () => {
        expect(requiredRule(row({ is_required: 0 }))).toBeUndefined()
    })
})

describe("coerceValues", () => {
    it("coerces Number strings to numbers", () => {
        const fields = [row({ fieldname: "qty", type: "Number" })]
        expect(coerceValues(fields, { qty: "42" })).toEqual({ qty: 42 })
    })

    it("coerces Checkbox truthiness to 0 | 1", () => {
        const fields = [row({ fieldname: "done", type: "Checkbox" })]
        expect(coerceValues(fields, { done: true })).toEqual({ done: 1 })
        expect(coerceValues(fields, { done: 0 })).toEqual({ done: 0 })
    })

    it("normalizes datetime-local to Frappe's space-separated seconds format", () => {
        const fields = [row({ fieldname: "at", type: "Datetime" })]
        expect(coerceValues(fields, { at: "2026-08-06T14:30" })).toEqual({ at: "2026-08-06 14:30:00" })
        expect(coerceValues(fields, { at: "2026-08-06 14:30:00" })).toEqual({ at: "2026-08-06 14:30:00" })
    })

    it("leaves empty values and unrelated fields untouched", () => {
        const fields = [row({ fieldname: "qty", type: "Number" }), row({ fieldname: "note", type: "Data" })]
        expect(coerceValues(fields, { qty: "", note: "hi" })).toEqual({ qty: "", note: "hi" })
    })
})

describe("seedDefaults", () => {
    it("seeds an empty string for a default-less Data field", () => {
        const fields = [row({ fieldname: "reason", type: "Data" })]
        expect(seedDefaults(fields, {})).toEqual({ reason: "" })
    })

    it("seeds 0 for a default-less Checkbox field", () => {
        const fields = [row({ fieldname: "done", type: "Checkbox" })]
        expect(seedDefaults(fields, {})).toEqual({ done: 0 })
    })

    it("lets a server default win over the seed", () => {
        const fields = [row({ fieldname: "reason", type: "Data" })]
        expect(seedDefaults(fields, { reason: "Prefilled" })).toEqual({ reason: "Prefilled" })
    })

    it("seeds only the fields absent from serverDefaults, keeping present ones as-is", () => {
        const fields = [
            row({ fieldname: "reason", type: "Data" }),
            row({ fieldname: "priority", type: "Select" }),
        ]
        expect(seedDefaults(fields, { priority: "High" })).toEqual({ reason: "", priority: "High" })
    })

    it("coerces a stringy Checkbox default of \"1\" to 1", () => {
        const fields = [row({ fieldname: "done", type: "Checkbox" })]
        expect(seedDefaults(fields, { done: "1" })).toEqual({ done: 1 })
    })

    it("coerces a stringy Checkbox default of \"0\" to 0, not the truthy-string 1", () => {
        const fields = [row({ fieldname: "done", type: "Checkbox" })]
        expect(seedDefaults(fields, { done: "0" })).toEqual({ done: 0 })
    })

    it("leaves an already-numeric Checkbox default of 1 as 1", () => {
        const fields = [row({ fieldname: "done", type: "Checkbox" })]
        expect(seedDefaults(fields, { done: 1 })).toEqual({ done: 1 })
    })

    it("normalizes a Frappe Datetime default to the datetime-local input format", () => {
        const fields = [row({ fieldname: "at", type: "Datetime" })]
        expect(seedDefaults(fields, { at: "2026-08-06 12:34:56.123456" })).toEqual({ at: "2026-08-06T12:34" })
    })

    it("leaves a Datetime default already in datetime-local format untouched", () => {
        const fields = [row({ fieldname: "at", type: "Datetime" })]
        expect(seedDefaults(fields, { at: "2026-08-06T12:34" })).toEqual({ at: "2026-08-06T12:34" })
    })
})
