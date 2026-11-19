import { describe, expect, it } from "vitest"
import type { UserData } from "@db"
import type { ContactPayload } from "@lib/contact"
import { matchContactUser } from "./contactUser"

const user = (name: string, overrides: Partial<UserData> = {}): UserData => ({
    name,
    full_name: name,
    type: "User",
    ...overrides,
})

const contact = (emails: string[]): ContactPayload => ({
    name: "Priya",
    phones: [],
    emails: emails.map((value) => ({ value })),
})

const users = new Map<string, UserData>([
    ["priya@northwind.co", user("priya@northwind.co")],
    ["amit@northwind.co", user("amit@northwind.co")],
])

describe("matchContactUser", () => {
    it("matches a shared email ignoring case and whitespace", () => {
        expect(matchContactUser(contact([" Priya@Northwind.CO "]), users, "me@x.com")?.user.name).toBe(
            "priya@northwind.co"
        )
    })

    it("uses the first matching email", () => {
        expect(matchContactUser(contact(["unknown@x.com", "amit@northwind.co", "priya@northwind.co"]), users, "me@x.com")?.user.name).toBe(
            "amit@northwind.co"
        )
    })

    it("ignores disabled users and bots", () => {
        const map = new Map<string, UserData>([
            ["off@x.com", user("off@x.com", { enabled: 0 })],
            ["bot@x.com", user("bot@x.com", { type: "Bot" })],
        ])
        expect(matchContactUser(contact(["off@x.com"]), map, "me@x.com")).toBeNull()
        expect(matchContactUser(contact(["bot@x.com"]), map, "me@x.com")).toBeNull()
    })

    it("skips a disabled match for a later enabled one", () => {
        const map = new Map<string, UserData>([
            ["off@x.com", user("off@x.com", { enabled: 0 })],
            ["amit@northwind.co", user("amit@northwind.co")],
        ])
        expect(matchContactUser(contact(["off@x.com", "amit@northwind.co"]), map, "me@x.com")?.user.name).toBe(
            "amit@northwind.co"
        )
    })

    it("flags the current user", () => {
        const match = matchContactUser(contact(["Priya@Northwind.co"]), users, "priya@northwind.co")
        expect(match?.isSelf).toBe(true)
        expect(match?.user.name).toBe("priya@northwind.co")
    })

    it("does not flag another user as self", () => {
        expect(matchContactUser(contact(["amit@northwind.co"]), users, "priya@northwind.co")?.isSelf).toBe(false)
    })

    it("returns null without emails", () => {
        expect(matchContactUser(contact([]), users, "me@x.com")).toBeNull()
    })
})
