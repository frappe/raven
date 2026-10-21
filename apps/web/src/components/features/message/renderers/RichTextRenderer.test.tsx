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
})
