import { describe, expect, it } from "vitest"
import { teamPreviewPeople } from "./teamPreview"

const siteUsers = [{ user: "priya@acme.com", full_name: "Priya", user_image: "/files/p.png" }]

describe("teamPreviewPeople", () => {
    it("lists site users, then sent invites, then invite rows", () => {
        const people = teamPreviewPeople([{ email: "ravi@acme.com", first_name: "Ravi" }], [{ email: "sam@acme.com", first_name: "" }], siteUsers)
        expect(people.map((person) => person.name)).toEqual(["Priya", "sam@acme.com", "Ravi"])
    })

    it("keeps a row's id while it's typed into", () => {
        const before = teamPreviewPeople([{ email: "", first_name: "" }], [], siteUsers)
        const after = teamPreviewPeople([{ email: "", first_name: "Ra" }], [], siteUsers)
        expect(after.map((person) => person.id)).toEqual(before.map((person) => person.id))
    })

    it("keeps everyone else's id when a row is added", () => {
        const one = teamPreviewPeople([{ email: "", first_name: "Ravi" }], [], siteUsers)
        const two = teamPreviewPeople([{ email: "", first_name: "Ravi" }, { email: "", first_name: "" }], [], siteUsers)
        expect(two.map((person) => person.id)).toEqual(expect.arrayContaining(one.map((person) => person.id)))
    })

    it("shows a blank row with no name", () => {
        expect(teamPreviewPeople([{ email: " ", first_name: "" }], [], [])[0].name).toBe("")
    })
})
