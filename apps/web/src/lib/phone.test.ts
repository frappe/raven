import { afterEach, describe, expect, it, vi } from "vitest"
import { withCountryCodes } from "./phone"

afterEach(() => vi.unstubAllGlobals())

const inIndia = () => vi.stubGlobal("window", { frappe: { boot: { raven_phone_region: "IN" } } })

describe("withCountryCodes", () => {
    it("gives a local number the sender's country code", async () => {
        inIndia()
        expect(await withCountryCodes([{ value: "866-8776631", label: "Mobile" }])).toEqual([
            { value: "+91 86687 76631", label: "Mobile" },
        ])
    })

    it("keeps another country's code and leaves invalid numbers as typed", async () => {
        inIndia()
        expect(await withCountryCodes([{ value: "+1 415 555 2671" }, { value: "12" }])).toEqual([
            { value: "+1 415 555 2671" },
            { value: "12" },
        ])
    })

    it("drops a number that formats to one already listed", async () => {
        inIndia()
        expect(await withCountryCodes([{ value: "866-8776631" }, { value: "+918668776631" }])).toEqual([
            { value: "+91 86687 76631" },
        ])
    })

    it("leaves local numbers as typed when the region is unknown", async () => {
        vi.stubGlobal("window", { frappe: { boot: {} } })
        expect(await withCountryCodes([{ value: "866-8776631" }])).toEqual([{ value: "866-8776631" }])
    })
})
