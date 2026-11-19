import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { RichTextRenderer } from "./RichTextRenderer"

const render = (html: string) => renderToStaticMarkup(<RichTextRenderer html={html} />)

describe("RichTextRenderer", () => {
    it("drops tags that load a document or reach the page, keeping the text around them", () => {
        const html =
            '<p>before</p><iframe src="https://localhost/_raven_media_/x.svg"></iframe><object data="x.svg"></object>' +
            '<embed src="x.svg"><script>alert(1)</script><meta http-equiv="refresh" content="0;url=https://evil"><base href="https://evil/">' +
            '<style>body{display:none}</style><form action="https://evil"><input></form>' +
            '<svg><a href="#"><animate attributeName="href" to="javascript:alert(1)"/>x</a></svg><math></math><p>after</p>'
        const out = render(html)
        expect(out).not.toMatch(/<(iframe|object|embed|script|meta|base|style|form|input|svg|animate|math)\b/)
        expect(out).toContain("<p>before</p>")
        expect(out).toContain("<p>after</p>")
    })

    it("keeps ordinary message markup", () => {
        expect(render("<p><strong>bold</strong> <em>it</em></p><ul><li>one</li></ul>")).toContain("<strong>bold</strong>")
    })

    describe("KLIPY GIFs", () => {
        const gif = (src: string, size = 'width="498" height="280"') => `<p><img data-type="gif" src="${src}" alt="Hello" ${size}></p>`

        it("renders the URL as stored, in a box sized like a photo", () => {
            const out = render(gif("https://static.klipy.com/ii/a?x=1&amp;y=2"))
            expect(out).toContain('src="https://static.klipy.com/ii/a?x=1&amp;y=2"')
            expect(out).toContain('alt="Hello"')
            expect(out).toContain('loading="lazy"')
            expect(out).toContain('decoding="async"')
            expect(out).toContain('style="width:480px;aspect-ratio:498 / 280"')
        })

        it("fits a tall GIF to the height bound", () => {
            expect(render(gif("https://static.klipy.com/ii/a", 'width="300" height="1200"'))).toContain('style="width:96px;aspect-ratio:300 / 1200"')
        })

        it("falls back to the photo placeholder box without usable sizes", () => {
            expect(render(gif("https://static.klipy.com/ii/a", 'width="x" height="-4"'))).toContain('style="width:320px;aspect-ratio:4 / 3"')
        })

        it("renders nothing for a src that isn't on a KLIPY host", () => {
            for (const src of ["https://evil.com/a.gif", "javascript:alert(1)", "/private/files/a.gif"]) expect(render(gif(src))).not.toContain("<img")
        })
    })
})
