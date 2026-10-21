import { describe, expect, it } from "vitest"
import { buildPreviewModel, type PreviewModel } from "./model"

const saved: PreviewModel = {
    profile: { name: "Aditya Patil", image: "/files/a.png" },
    workspace: { name: "Acme", logo: "/files/acme.png" },
    channel: { name: "general" },
    people: [{ id: "user-priya", name: "Priya" }],
    leave: false,
}

describe("buildPreviewModel", () => {
    it("shows saved data when there's no draft", () => {
        expect(buildPreviewModel(saved, {})).toEqual(saved)
    })

    it("lets the open step's draft override what's saved", () => {
        const model = buildPreviewModel(saved, { workspace: { name: "Acme Labs" } })
        expect(model.workspace).toEqual({ name: "Acme Labs", logo: "/files/acme.png" })
        expect(model.profile).toEqual(saved.profile)
    })

    it("falls back to saved data when a draft field is empty", () => {
        const model = buildPreviewModel(saved, { profile: { name: "   " }, workspace: { name: "" } })
        expect(model.profile?.name).toBe("Aditya Patil")
        expect(model.workspace?.name).toBe("Acme")
    })

    it("takes the channel type the open step has picked", () => {
        const model = buildPreviewModel({ ...saved, channel: { name: "general", type: "Public" } }, { channel: { name: "general", type: "Private" } })
        expect(model.channel).toEqual({ name: "general", type: "Private" })
    })

    it("leaves a part out when neither saved nor draft has a name", () => {
        const empty: PreviewModel = { people: [], leave: false }
        const model = buildPreviewModel(empty, { workspace: { name: " " } })
        expect(model.workspace).toBeUndefined()
    })

    it("takes the team step's own list of people in place of the saved one", () => {
        const model = buildPreviewModel(saved, { people: [{ id: "a", name: "Priya" }, { id: "b", name: "Ravi" }] })
        expect(model.people).toEqual([{ id: "a", name: "Priya" }, { id: "b", name: "Ravi" }])
    })

    it("keeps the team step's blank rows, so an added row shows before it's filled", () => {
        const model = buildPreviewModel(saved, { people: [{ id: "a", name: "Ravi" }, { id: "b", name: "" }] })
        expect(model.people).toEqual([{ id: "a", name: "Ravi" }, { id: "b", name: "" }])
    })

    it("keeps the saved people when no step is listing them", () => {
        expect(buildPreviewModel(saved, {}).people).toEqual(saved.people)
    })

    it("shows leave as the HR step's toggle has it", () => {
        expect(buildPreviewModel(saved, { leave: true }).leave).toBe(true)
        expect(buildPreviewModel({ ...saved, leave: true }, { leave: false }).leave).toBe(false)
    })

    it("keeps the saved leave flag when no step is setting it", () => {
        expect(buildPreviewModel({ ...saved, leave: true }, {}).leave).toBe(true)
    })
})
