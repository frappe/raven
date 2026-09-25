import { describe, expect, it } from "vitest"
import { versionAtLeast, versionMismatch } from "./version"

describe("versionMismatch", () => {
    it("is silent on a patch difference", () => { expect(versionMismatch("3.1.4", "3.1.1")).toBeNull() })
    it("flags a minor difference either way", () => {
        expect(versionMismatch("3.3.0", "3.1.1")).toBe("minor")
        expect(versionMismatch("3.1.1", "3.3.0")).toBe("minor")
    })
    it("flags a major difference", () => { expect(versionMismatch("4.0.0", "3.9.9")).toBe("minor") })
    it("is silent when either side is unknown", () => { expect(versionMismatch("", "3.1.0")).toBeNull() })
})

describe("versionAtLeast", () => {
    it("compares numerically", () => { expect(versionAtLeast("3.10.0", "3.9.0")).toBe(true) })
})
