import { afterEach, describe, expect, it, vi } from "vitest"
import { normalizePicked, pickContact, saveContact } from "./contacts"

const plugin = { pickContact: vi.fn(), saveContact: vi.fn() }
vi.mock("./platform", () => ({
    nativePlatform: () => (globalThis as { __platform?: string }).__platform ?? "web",
    nativePlugin: () => () => Promise.resolve({ plugin }),
}))

afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    delete (globalThis as { __platform?: string }).__platform
})

describe("normalizePicked", () => {
    it("normalizes the Android Chrome shape and dedupes blanks", () => {
        const icon = new Blob(["photo"], { type: "image/jpeg" })
        expect(normalizePicked({
            name: ["Priya"],
            tel: ["+91 1", "+91 1", ""],
            email: ["a@b.co"],
            icon: [icon],
        })).toEqual({
            name: "Priya",
            phones: [{ value: "+91 1" }],
            emails: [{ value: "a@b.co" }],
            photo: icon,
        })
    })

    it("passes the native shape through with its labels", () => {
        expect(normalizePicked({
            name: "Priya",
            phones: [{ value: "+91 1", label: "Mobile" }],
            emails: [{ value: "a@b.co", label: "Work" }],
            photo: "base64",
        })).toEqual({
            name: "Priya",
            phones: [{ value: "+91 1", label: "Mobile" }],
            emails: [{ value: "a@b.co", label: "Work" }],
            photo: "base64",
        })
    })

    it("falls back to the first phone or email when the name is empty", () => {
        expect(normalizePicked({ name: [""], tel: ["+91 1"] })).toEqual({
            name: "+91 1",
            phones: [{ value: "+91 1" }],
            emails: [],
        })
        expect(normalizePicked({ name: "", emails: [{ value: "a@b.co" }] })).toEqual({
            name: "a@b.co",
            phones: [],
            emails: [{ value: "a@b.co" }],
        })
    })

    it("is null when only a name is left", () => {
        expect(normalizePicked({ name: ["Priya"], tel: [""], email: [] })).toBeNull()
        expect(normalizePicked({})).toBeNull()
        expect(normalizePicked(null)).toBeNull()
    })
})

describe("native field cleaning", () => {
    it("trims, dedupes and drops non-text labels", () => {
        expect(normalizePicked({
            name: " Priya ",
            phones: [{ value: " +91 1 ", label: "Mobile" }, { value: "+91 1" }, { value: "2", label: 5 }],
            emails: [],
        })).toEqual({ name: "Priya", phones: [{ value: "+91 1", label: "Mobile" }, { value: "2" }], emails: [] })
    })
})

describe("pickContact", () => {
    it("tells cancel, failure and a contact with nothing to share apart", async () => {
        vi.stubGlobal("navigator", { contacts: { select: vi.fn().mockResolvedValue([]) } })
        expect(await pickContact()).toEqual({ status: "cancelled" })
        vi.stubGlobal("navigator", { contacts: { select: vi.fn().mockRejectedValue(new Error("busy")) } })
        expect(await pickContact()).toEqual({ status: "failed" })
        vi.stubGlobal("navigator", { contacts: { select: vi.fn().mockResolvedValue([{ name: ["Priya"], tel: [], email: [] }]) } })
        expect(await pickContact()).toEqual({ status: "empty", name: "Priya" })
    })
})

describe("saveContact", () => {
    const contact = { name: "Priya", phones: [{ value: "1" }], emails: [] }

    it("saves without the photo when it can't be fetched", async () => {
        ;(globalThis as { __platform?: string }).__platform = "ios"
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
        await saveContact(contact, "/private/files/contact.jpg")
        expect(plugin.saveContact).toHaveBeenCalledWith({ name: "Priya", phones: [{ value: "1" }], emails: [] })

        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
        await saveContact(contact, "/private/files/contact.jpg")
        expect(plugin.saveContact).toHaveBeenLastCalledWith({ name: "Priya", phones: [{ value: "1" }], emails: [] })
    })

describe("native pickContact", () => {
    it("treats an empty native resolve as cancel, not failure", async () => {
        ;(globalThis as { __platform?: string }).__platform = "ios"
        plugin.pickContact.mockResolvedValue(undefined)
        expect(await pickContact()).toEqual({ status: "cancelled" })
        plugin.pickContact.mockResolvedValue({})
        expect(await pickContact()).toEqual({ status: "cancelled" })
    })
})
})
