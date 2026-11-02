import { afterEach, describe, expect, it, vi } from "vitest"
import { uploadFileWithin, withTimeout } from "./uploadWithin"

const FILE = { size: 12 } as File
const UPLOADED = { name: "file-1", file_url: "/files/location.webp", file_size: 12 }

const inTime = () => async () => FILE
const uploaded = () => async () => UPLOADED
const removed = () => async () => undefined

afterEach(() => vi.useRealTimers())

describe("uploadFileWithin", () => {
    it("skips the upload when the render outlasts the cap", async () => {
        vi.useFakeTimers()
        const upload = vi.fn(uploaded())
        const result = uploadFileWithin({
            render: () => new Promise((resolve) => setTimeout(() => resolve(FILE), 6000)),
            upload,
            remove: removed(),
            ms: 5000,
            token: { abandoned: false },
        })

        await vi.advanceTimersByTimeAsync(5000)
        await expect(result).resolves.toBeNull()
        await vi.advanceTimersByTimeAsync(1000)
        expect(upload).not.toHaveBeenCalled()
    })

    it("deletes an upload that lands after the cap", async () => {
        vi.useFakeTimers()
        const remove = vi.fn(removed())
        const result = uploadFileWithin({
            render: inTime(),
            upload: () => new Promise((resolve) => setTimeout(() => resolve(UPLOADED), 6000)),
            remove,
            ms: 5000,
            token: { abandoned: false },
        })

        await vi.advanceTimersByTimeAsync(5000)
        await expect(result).resolves.toBeNull()
        await vi.advanceTimersByTimeAsync(1000)
        expect(remove).toHaveBeenCalledWith("file-1")
    })

    it("returns the uploaded file when it lands in time", async () => {
        const remove = vi.fn(removed())
        const result = uploadFileWithin({
            render: inTime(),
            upload: uploaded(),
            remove,
            ms: 5000,
            token: { abandoned: false },
        })

        await expect(result).resolves.toEqual({
            file: { file_url: "/files/location.webp", file_size: 12 },
            name: "file-1",
        })
        expect(remove).not.toHaveBeenCalled()
    })

    it("removes an upload that resolves after the caller abandons the token", async () => {
        vi.useFakeTimers()
        let finishUpload: ((file: typeof UPLOADED) => void) | undefined
        const remove = vi.fn(removed())
        const token = { abandoned: false }
        const result = uploadFileWithin({
            render: inTime(),
            upload: () => new Promise((resolve) => { finishUpload = resolve }),
            remove,
            ms: 5000,
            token,
        })

        await vi.advanceTimersByTimeAsync(0)
        token.abandoned = true
        finishUpload?.(UPLOADED)
        await expect(result).resolves.toBeNull()
        expect(remove).toHaveBeenCalledWith("file-1")
    })

    it("ignores a delete rejection", async () => {
        vi.useFakeTimers()
        const remove = vi.fn(async () => {
            throw new Error("file already gone")
        })
        const result = uploadFileWithin({
            render: inTime(),
            upload: () => new Promise((resolve) => setTimeout(() => resolve(UPLOADED), 6000)),
            remove,
            ms: 5000,
            token: { abandoned: false },
        })

        await vi.advanceTimersByTimeAsync(5000)
        await expect(result).resolves.toBeNull()
        await vi.advanceTimersByTimeAsync(1000)
        expect(remove).toHaveBeenCalledWith("file-1")
    })
})

describe("withTimeout", () => {
    it("times out a slow snapshot", async () => {
        vi.useFakeTimers()
        const result = withTimeout(new Promise(() => {}), 5000)
        vi.advanceTimersByTime(5000)
        await expect(result).resolves.toBeNull()
    })

    it("passes a fast result through", async () => {
        await expect(withTimeout(Promise.resolve("ok"), 5000)).resolves.toBe("ok")
    })
})
