import { describe, expect, it } from "vitest"
import { isVCardFile, parseVCards } from "./vcard"

const ios = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:Sharma;Priya;;;",
    "FN:Priya Sharma",
    "item1.TEL;type=pref:+91 98200 41234",
    "item1.X-ABLabel:_$!<Mobile>!$_",
    "TEL;type=CELL;type=VOICE:+91 22 1234 5678",
    "EMAIL;type=INTERNET;type=WORK:priya@northwind.test",
    "PHOTO;ENCODING=b;TYPE=JPEG:QUJD",
    " REVG",
    "END:VCARD",
].join("\r\n")

const android = [
    "BEGIN:VCARD",
    "VERSION:2.1",
    "N:;प्रिया;;;",
    "FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=E0=A4=AA=E0=A5=8D=E0=A4=B0=",
    " =E0=A4=BF=E0=A4=AF=E0=A4=BE",
    "TEL;CELL:+91 98200 41234",
    "TEL;HOME:+91 22 1234 5678",
    "EMAIL;HOME:priya@northwind.test",
    "END:VCARD",
].join("\n")

const v4 = [
    "BEGIN:VCARD",
    "VERSION:4.0",
    "FN:Sam Lee",
    "TEL;TYPE=work,voice;VALUE=uri:tel:+1-555-0100",
    "PHOTO:data:image/jpeg;base64,QUJD",
    "END:VCARD",
].join("\n")

const file = (name: string, type = "") => new File([], name, { type })

describe("parseVCards", () => {
    it("reads iOS 3.0 labels, folding and a folded base64 photo", () => {
        expect(parseVCards(ios)).toEqual([
            {
                name: "Priya Sharma",
                phones: [
                    { value: "+91 98200 41234", label: "Mobile" },
                    { value: "+91 22 1234 5678", label: "Mobile" },
                ],
                emails: [{ value: "priya@northwind.test", label: "Work" }],
                photo: "QUJDREVG",
            },
        ])
    })

    it("decodes Android 2.1 quoted-printable, including a soft break", () => {
        expect(parseVCards(android)).toEqual([
            {
                name: "प्रिया",
                phones: [
                    { value: "+91 98200 41234", label: "Mobile" },
                    { value: "+91 22 1234 5678", label: "Home" },
                ],
                emails: [{ value: "priya@northwind.test", label: "Home" }],
            },
        ])
    })

    it("reads vCard 4.0 URI phones and data-URI photos", () => {
        expect(parseVCards(v4)).toEqual([
            { name: "Sam Lee", phones: [{ value: "+1-555-0100", label: "Work" }], emails: [], photo: "QUJD" },
        ])
    })

    it("returns several cards in file order", () => {
        const cards = parseVCards(`${ios}\n${v4}`)
        expect(cards.map((card) => card.name)).toEqual(["Priya Sharma", "Sam Lee"])
    })

    it("builds the name from N and unescapes text", () => {
        const card = parseVCards(
            ["BEGIN:VCARD", "N:Sharma;Priya\\; Jr;;;", "FN:Priya\\, Sharma\\nJr", "TEL:123", "END:VCARD"].join("\n"),
        )
        expect(card[0].name).toBe("Priya, Sharma\nJr")

        const fromN = parseVCards(["BEGIN:VCARD", "N:Sharma;Priya;;;", "TEL:123", "END:VCARD"].join("\n"))
        expect(fromN[0].name).toBe("Priya Sharma")

        const blankFn = parseVCards(["BEGIN:VCARD", "N:Sharma;Priya;;;", "FN:", "TEL:123", "END:VCARD"].join("\n"))
        expect(blankFn[0].name).toBe("Priya Sharma")
    })

    it("keeps a card without a phone or email for the caller to drop", () => {
        const cards = parseVCards(["BEGIN:VCARD", "FN:Solo", "END:VCARD"].join("\n"))
        expect(cards).toEqual([{ name: "Solo", phones: [], emails: [] }])
    })

    it("ignores remote photo URLs and unknown types", () => {
        const card = parseVCards(
            [
                "BEGIN:VCARD",
                "FN:Priya",
                "TEL;TYPE=FAX:+1-555",
                "PHOTO;VALUE=uri:https://example.com/photo.jpg",
                "END:VCARD",
            ].join("\n"),
        )
        expect(card[0]).toEqual({ name: "Priya", phones: [{ value: "+1-555" }], emails: [] })
    })
})

describe("isVCardFile", () => {
    it("matches the vCard MIME types", () => {
        expect(isVCardFile(file("contact", "text/vcard"))).toBe(true)
        expect(isVCardFile(file("contact", "text/x-vcard"))).toBe(true)
        expect(isVCardFile(file("contact", "text/directory"))).toBe(true)
    })

    it("matches a .vcf name whatever the MIME type", () => {
        expect(isVCardFile(file("Priya.VCF", "application/octet-stream"))).toBe(true)
    })

    it("rejects other files", () => {
        expect(isVCardFile(file("photo.jpg", "image/jpeg"))).toBe(false)
    })

    it("splits N only on unescaped semicolons when FN is missing", () => {
        const card = ["BEGIN:VCARD", "VERSION:3.0", "N:Mehta\\;Jr;Arjun;;;", "TEL:1", "END:VCARD"].join("\n")
        expect(parseVCards(card)[0].name).toBe("Arjun Mehta;Jr")
    })

    it("keeps a custom X-ABLabel and returns nothing for garbage", () => {
        const card = ["BEGIN:VCARD", "VERSION:3.0", "FN:Pat", "item1.TEL:2", "item1.X-ABLabel:Pager", "END:VCARD"].join("\n")
        expect(parseVCards(card)[0].phones).toEqual([{ value: "2", label: "Pager" }])
        expect(parseVCards("not a vcard\n:::\n;;")).toEqual([])
    })
})
