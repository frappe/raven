import { afterEach, describe, expect, it } from "vitest"
import { setActiveSite, _resetActiveSite } from "@lib/site"
import { mediaKeepOrder } from "./media"
import { mediaFolder } from "./mediaUrl"

afterEach(() => _resetActiveSite())

describe("mediaKeepOrder", () => {
    it("lists cache folders newest message first, without duplicates", () => {
        setActiveSite("https://a.com", () => "AT")
        const m = (name: string, creation: string, file?: string) => ({ name, creation, file }) as never
        const windows = [
            { channel_id: "a", rows: [m("1", "2026-01-01 00:00:00.000000", "/private/files/old.png"), m("2", "2026-01-03 00:00:00.000000", "/private/files/new.png"), m("5", "2026-01-05 00:00:00.000000")] },
            { channel_id: "b", rows: [m("3", "2026-01-02 00:00:00.000000", "/private/files/mid.png"), m("4", "2026-01-04 00:00:00.000000", "/private/files/new.png")] },
        ]
        const folder = (p: string) => mediaFolder(p).folder
        expect(mediaKeepOrder(windows)).toEqual([folder("/private/files/new.png"), folder("/private/files/mid.png"), folder("/private/files/old.png")])
    })
})
