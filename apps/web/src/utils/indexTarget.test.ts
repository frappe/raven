import { describe, expect, it } from "vitest"
import type { WorkspaceFields } from "@hooks/useWorkspaces"
import { getIndexTarget } from "./indexTarget"

const member = (name: string): WorkspaceFields => ({ name, workspace_name: name, type: "Public", workspace_member_name: `m-${name}` })
const nonMember = (name: string): WorkspaceFields => ({ name, workspace_name: name, type: "Public" })

const base = { lastWorkspace: "", lastChannel: "", workspaces: [] as WorkspaceFields[], isMobile: false }

describe("getIndexTarget", () => {
    it("reopens the remembered channel on desktop", () => {
        expect(getIndexTarget({ ...base, lastWorkspace: "Eng", lastChannel: "general", workspaces: [member("Eng")] }))
            .toBe("/Eng/general")
    })

    it("opens the remembered workspace's list on mobile", () => {
        expect(getIndexTarget({ ...base, lastWorkspace: "Eng", lastChannel: "general", workspaces: [member("Eng")], isMobile: true }))
            .toBe("/Eng")
    })

    it("skips a remembered workspace the user is no longer in", () => {
        expect(getIndexTarget({ ...base, lastWorkspace: "Old", lastChannel: "x", workspaces: [nonMember("Old"), member("Eng")] }))
            .toBe("/Eng")
    })

    it("falls back to the first workspace the user belongs to", () => {
        expect(getIndexTarget({ ...base, workspaces: [nonMember("Public"), member("Eng"), member("Ops")] }))
            .toBe("/Eng")
    })

    it("has no target for users in no workspace", () => {
        expect(getIndexTarget({ ...base, workspaces: [nonMember("Public")] })).toBeNull()
        expect(getIndexTarget(base)).toBeNull()
    })

    it("encodes names in the path", () => {
        expect(getIndexTarget({ ...base, lastWorkspace: "R&D", lastChannel: "a b", workspaces: [member("R&D")] }))
            .toBe("/R%26D/a%20b")
    })
})
