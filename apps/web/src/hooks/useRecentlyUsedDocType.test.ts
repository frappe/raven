import { describe, expect, it } from "vitest"
import { toMostRecent } from "./useRecentlyUsedDocType"

describe("toMostRecent", () => {
    it("prepends a new entry", () => {
        expect(toMostRecent(["Task"], "Issue")).toEqual(["Issue", "Task"])
    })

    it("bumps an existing entry to the front instead of ignoring it", () => {
        expect(toMostRecent(["Task", "Issue", "Lead"], "Lead")).toEqual(["Lead", "Task", "Issue"])
    })

    it("never duplicates", () => {
        expect(toMostRecent(["Task", "Issue"], "Task")).toEqual(["Task", "Issue"])
    })

    it("caps the list at the limit, dropping the oldest", () => {
        expect(toMostRecent(["A", "B", "C", "D", "E"], "F", 5)).toEqual(["F", "A", "B", "C", "D"])
    })

    it("handles an empty list", () => {
        expect(toMostRecent([], "Task")).toEqual(["Task"])
    })
})
