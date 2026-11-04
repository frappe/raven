import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { GifUnavailable } from "./GifImage"

describe("GifUnavailable", () => {
    // _() reads window.frappe for translations.
    beforeEach(() => vi.stubGlobal("window", {}))
    afterEach(() => vi.unstubAllGlobals())

    it("holds the GIF's box with a label instead of a broken image", () => {
        const out = renderToStaticMarkup(<GifUnavailable style={{ width: 480, aspectRatio: "498 / 280" }} />)
        expect(out).toContain('style="width:480px;aspect-ratio:498 / 280"')
        expect(out).toContain("GIF unavailable")
        expect(out).not.toContain("<img")
    })
})
