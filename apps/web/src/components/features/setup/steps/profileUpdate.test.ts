import { describe, expect, it } from "vitest"
import { buildProfileUpdate } from "./profileUpdate"

const saved = { full_name: "Aditya Patil", user_image: "/files/a.png" }

describe("buildProfileUpdate", () => {
    it("marks the user onboarded even when nothing changed", () => {
        expect(buildProfileUpdate(saved, { full_name: "Aditya Patil", user_image: "/files/a.png" })).toEqual({ onboarded: 1 })
    })

    it("saves a changed name, trimmed", () => {
        expect(buildProfileUpdate(saved, { full_name: "  Aditya P ", user_image: "/files/a.png" })).toEqual({ full_name: "Aditya P", onboarded: 1 })
    })

    it("treats extra spaces alone as an unchanged name", () => {
        expect(buildProfileUpdate(saved, { full_name: "Aditya Patil  ", user_image: "/files/a.png" })).toEqual({ onboarded: 1 })
    })

    it("saves a new photo", () => {
        expect(buildProfileUpdate(saved, { full_name: "Aditya Patil", user_image: "/files/b.png" })).toEqual({ user_image: "/files/b.png", onboarded: 1 })
    })

    it("saves a removed photo as empty", () => {
        expect(buildProfileUpdate(saved, { full_name: "Aditya Patil", user_image: "" })).toEqual({ user_image: "", onboarded: 1 })
    })

    it("treats no saved photo and none picked as unchanged", () => {
        expect(buildProfileUpdate({ full_name: "Aditya", user_image: null }, { full_name: "Aditya", user_image: "" })).toEqual({ onboarded: 1 })
    })
})
