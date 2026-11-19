import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { ReservedImage } from "./ReservedImage"

describe("ReservedImage", () => {
    it("loads lazily and decodes off the main thread", () => {
        const out = renderToStaticMarkup(<ReservedImage src="/files/photo.png" alt="Photo" />)
        expect(out).toContain('loading="lazy"')
        expect(out).toContain('decoding="async"')
    })
})
