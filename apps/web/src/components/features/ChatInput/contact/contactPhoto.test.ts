import { describe, expect, it } from "vitest"
import { contactPhotoFile, photoBlob, squareCrop } from "./contactPhoto"

describe("squareCrop", () => {
    it("centre-crops a landscape photo", () => {
        expect(squareCrop(400, 300)).toEqual({ sx: 50, sy: 0, side: 300, out: 256 })
    })

    it("never upscales a small photo", () => {
        expect(squareCrop(100, 100)).toEqual({ sx: 0, sy: 0, side: 100, out: 100 })
    })
})

describe("contactPhotoFile", () => {
    it("names the file contact.jpg as a JPEG", () => {
        const file = contactPhotoFile(new Blob([]))
        expect(file.name).toBe("contact.jpg")
        expect(file.type).toBe("image/jpeg")
    })
})

describe("photoBlob", () => {
    it("decodes bare base64", async () => {
        const blob = await photoBlob(btoa("photo"))
        await expect(blob.text()).resolves.toBe("photo")
    })

    it("passes a Blob through", async () => {
        const source = new Blob(["photo"])
        await expect(photoBlob(source)).resolves.toBe(source)
    })
})
