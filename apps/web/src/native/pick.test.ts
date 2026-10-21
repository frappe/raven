import { beforeEach, describe, expect, it, vi } from "vitest"
import { pickNativeFiles } from "./pick"

const m = vi.hoisted(() => ({
    pickFiles: vi.fn(), pickMedia: vi.fn(), convertHeicToJpeg: vi.fn(), deleteFile: vi.fn(async () => { }),
    dismissed: [] as (() => void)[], addListener: vi.fn(),
    read: vi.fn(), toastError: vi.fn(),
}))
vi.mock("@capawesome/capacitor-file-picker", () => ({ FilePicker: { pickFiles: m.pickFiles, pickMedia: m.pickMedia, convertHeicToJpeg: m.convertHeicToJpeg, addListener: m.addListener } }))
vi.mock("@capacitor/filesystem", () => ({ Filesystem: { deleteFile: m.deleteFile } }))
vi.mock("./shareIn", () => ({ readNativeFiles: m.read }))
vi.mock("sonner", () => ({ toast: { error: m.toastError } }))
vi.mock("@lib/translate", () => ({ default: (s: string) => s }))

const picked = (name: string, mimeType: string) => ({ path: `file:///tmp/x/${name}`, name, mimeType, size: 1 })
const asFiles = (list: { name: string }[]) => list.map((f) => ({ name: f.name }) as File)

describe("pickNativeFiles", () => {
    beforeEach(() => {
        Object.values(m).forEach((fn) => { if (typeof fn === "function") fn.mockReset() })
        m.dismissed = []
        m.addListener.mockImplementation(async (_event: string, listener: () => void) => { m.dismissed.push(listener); return { remove: async () => { } } })
        m.deleteFile.mockResolvedValue(undefined); m.read.mockImplementation(async (list) => asFiles(list))
    })

    it("opens the photo library with transcoding on, and the document picker for files", async () => {
        m.pickMedia.mockResolvedValue({ files: [] }); m.pickFiles.mockResolvedValue({ files: [] })
        await pickNativeFiles("photos"); await pickNativeFiles("files")
        expect(m.pickMedia).toHaveBeenCalledWith({ skipTranscoding: false })
        expect(m.pickFiles).toHaveBeenCalledTimes(1)
    })
    it("is silent on a cancel, and says so when the plugin fails the pick", async () => {
        m.pickFiles.mockRejectedValueOnce(new Error("pickFiles canceled."))
        expect(await pickNativeFiles("files")).toEqual([])
        expect(m.toastError).not.toHaveBeenCalled()
        m.pickFiles.mockRejectedValueOnce(new Error("Unsupported file type identifier."))
        expect(await pickNativeFiles("files")).toEqual([])
        expect(m.toastError).toHaveBeenCalledTimes(1)
    })
    it("turns a HEIC photo into a JPEG, and keeps the original when that fails", async () => {
        m.pickMedia.mockResolvedValue({ files: [picked("IMG_1.HEIC", "image/heic"), picked("IMG_2.heic", "image/heif"), picked("a.png", "image/png")] })
        m.convertHeicToJpeg.mockResolvedValueOnce({ path: "file:///tmp/y/IMG_1.jpg" }).mockRejectedValueOnce(new Error("no"))
        await pickNativeFiles("photos")
        expect(m.read.mock.calls[0][0]).toEqual([
            { uri: "file:///tmp/y/IMG_1.jpg", name: "IMG_1.jpg", type: "image/jpeg" },
            { uri: "file:///tmp/x/IMG_2.heic", name: "IMG_2.heic", type: "image/heif" },
            { uri: "file:///tmp/x/a.png", name: "a.png", type: "image/png" },
        ])
    })
    it("deletes the plugin's copies once they are read, the converted one and its original too", async () => {
        m.pickMedia.mockResolvedValue({ files: [picked("IMG_1.HEIC", "image/heic"), picked("b.mov", "video/quicktime")] })
        m.convertHeicToJpeg.mockResolvedValue({ path: "file:///tmp/y/IMG_1.jpg" })
        await pickNativeFiles("photos")
        expect(m.deleteFile.mock.calls.map((c) => (c as unknown as [{ path: string }])[0].path).sort()).toEqual(["file:///tmp/x/IMG_1.HEIC", "file:///tmp/x/b.mov", "file:///tmp/y/IMG_1.jpg"])
    })
    it("names the picks before converting or reading them, a HEIC photo by its .jpg name", async () => {
        m.pickMedia.mockResolvedValue({ files: [picked("IMG_1.HEIC", "image/heic"), { name: "gone.png", mimeType: "image/png", size: 1 }, picked("b.mov", "video/quicktime")] })
        const order: string[] = []
        m.convertHeicToJpeg.mockImplementation(async () => { order.push("convert"); return { path: "file:///tmp/y/IMG_1.jpg" } })
        await pickNativeFiles("photos", { onNamed: (named) => { order.push("named"); expect(named).toEqual([{ name: "IMG_1.jpg", size: 1 }, { name: "b.mov", size: 1 }]) } })
        expect(order).toEqual(["named", "convert"])
    })
    it("reports a closed picker only while its files are still on their way, never for a cancel", async () => {
        vi.useFakeTimers()
        const onClosed = vi.fn()
        // A slow copy: closed, then the files arrive later.
        let hand: (v: { files: unknown[] }) => void = () => { }
        m.pickMedia.mockReturnValueOnce(new Promise((resolve) => { hand = resolve }))
        const slow = pickNativeFiles("photos", { onClosed })
        await vi.waitFor(() => expect(m.dismissed).toHaveLength(1))
        m.dismissed[0]()
        await vi.advanceTimersByTimeAsync(150)
        expect(onClosed).toHaveBeenCalledTimes(1)
        hand({ files: [] }); await slow
        // A cancel: the plugin answers right after the picker closes.
        m.pickMedia.mockImplementationOnce(async () => { m.dismissed[1](); throw new Error("pickMedia canceled.") })
        await pickNativeFiles("photos", { onClosed })
        await vi.advanceTimersByTimeAsync(150)
        expect(onClosed).toHaveBeenCalledTimes(1)
        vi.useRealTimers()
    })
    it("says so when the reader drops a file", async () => {
        m.pickFiles.mockResolvedValue({ files: [picked("a.pdf", "application/pdf"), picked("b.pdf", "application/pdf")] })
        m.read.mockImplementation(async (list) => asFiles(list.slice(0, 1)))
        expect((await pickNativeFiles("files")).length).toBe(1)
        expect(m.toastError).toHaveBeenCalledWith("Some of the selected files could not be attached.")
    })
})
