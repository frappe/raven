import { describe, expect, it } from "vitest"
import { toPythonIdentifier } from "./AgentApiDocsTab"

describe("toPythonIdentifier", () => {
    it("lowercases and joins words with single underscores", () => {
        expect(toPythonIdentifier("Sales Assistant")).toBe("sales_assistant")
        expect(toPythonIdentifier("HR - Helpdesk (v2)")).toBe("hr_helpdesk_v2")
    })

    it("never starts with a digit and never comes back empty", () => {
        expect(toPythonIdentifier("2nd Line Support")).toBe("bot_2nd_line_support")
        expect(toPythonIdentifier("---")).toBe("bot")
    })
})
