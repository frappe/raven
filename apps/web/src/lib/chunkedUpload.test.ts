import { afterEach, describe, expect, it, vi } from "vitest"
import { getChunkPlan, getFileChunkSize, isTransientUploadError, uploadInChunks, type SendChunk, type UploadFields } from "./chunkedUpload"

const makeFile = (size: number, name = "report.pdf") => new File([new Uint8Array(size)], name, { type: "application/pdf" })

/** A sendChunk that records each call, reports the blob as fully loaded and answers with its index. */
const recordingSender = (options: { failAt?: number } = {}) => {
    const calls: { blob: File; fields: UploadFields }[] = []
    const send: SendChunk<string> = async (blob, fields, onLoaded) => {
        calls.push({ blob, fields })
        if (calls.length - 1 === options.failAt) throw new Error("413")
        onLoaded(blob.size)
        return `response-${calls.length - 1}`
    }
    return { calls, send }
}

describe("getChunkPlan", () => {
    it("sends an empty file as one chunk", () => {
        expect(getChunkPlan(0, 10)).toEqual([{ index: 0, start: 0, end: 0 }])
    })
    it("sends a file of exactly one chunk size as one chunk", () => {
        expect(getChunkPlan(10, 10)).toEqual([{ index: 0, start: 0, end: 10 }])
    })
    it("splits the remainder into a last, shorter chunk", () => {
        const plan = getChunkPlan(25, 10)
        expect(plan.map((c) => c.index)).toEqual([0, 1, 2])
        expect(plan.map((c) => c.end)).toEqual([10, 20, 25])
    })
})

describe("getFileChunkSize", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })
    it("reads frappe.boot.file_chunk_size", () => {
        vi.stubGlobal("window", { frappe: { boot: { file_chunk_size: 1024 } } })
        expect(getFileChunkSize()).toBe(1024)
    })
    it("doesn't chunk when the server sends no chunk size", async () => {
        // Frappe v15 has no chunked uploads, so it sends no file_chunk_size.
        vi.stubGlobal("window", { frappe: { boot: {} } })
        const size = 25 * 1024 * 1024 + 1
        const { calls, send } = recordingSender()
        const fractions: number[] = []
        await uploadInChunks(makeFile(size), getFileChunkSize(), send, { onProgress: (f) => fractions.push(f) })
        expect(calls.map((c) => c.fields)).toEqual([{ total_file_size: size }])
        expect(fractions).toEqual([1])
    })
})

describe("uploadInChunks", () => {
    it("sends a large file as sequential chunks with Frappe's chunk fields", async () => {
        const file = makeFile(25)
        const { calls, send } = recordingSender()
        const outcome = await uploadInChunks(file, 10, send)

        expect(calls.map((c) => c.fields)).toEqual([
            { chunk_index: 0, total_chunk_count: 3, chunk_byte_offset: 0, total_file_size: 25 },
            { chunk_index: 1, total_chunk_count: 3, chunk_byte_offset: 10, total_file_size: 25 },
            { chunk_index: 2, total_chunk_count: 3, chunk_byte_offset: 20, total_file_size: 25 },
        ])
        expect(calls.map((c) => c.blob.size)).toEqual([10, 10, 5])
        expect(calls.every((c) => c.blob.name === "report.pdf")).toBe(true)
        expect(outcome).toEqual({ cancelled: false, result: "response-2" })
    })

    it("sends a small file whole, with only its total size", async () => {
        const file = makeFile(5)
        const { calls, send } = recordingSender()
        await uploadInChunks(file, 10, send)

        expect(calls).toHaveLength(1)
        expect(calls[0].blob).toBe(file)
        expect(calls[0].fields).toEqual({ total_file_size: 5 })
    })

    it("stops before the next chunk once the upload is no longer wanted", async () => {
        const { calls, send } = recordingSender()
        let wanted = true
        const outcome = await uploadInChunks(makeFile(25), 10, async (blob, fields, onLoaded) => {
            const response = await send(blob, fields, onLoaded)
            wanted = false
            return response
        }, { shouldContinue: () => wanted })

        expect(calls).toHaveLength(1)
        expect(outcome).toEqual({ cancelled: true })
    })

    it("rejects with the server error and sends nothing after the failed chunk", async () => {
        const { calls, send } = recordingSender({ failAt: 1 })
        await expect(uploadInChunks(makeFile(25), 10, send)).rejects.toThrow("413")
        expect(calls).toHaveLength(2)
    })

    it("reports progress across the whole file, ending at 1", async () => {
        const { send } = recordingSender()
        const fractions: number[] = []
        await uploadInChunks(makeFile(25), 10, send, { onProgress: (f) => fractions.push(f) })

        expect(fractions).toEqual([0.4, 0.8, 1])
    })
})

describe("isTransientUploadError", () => {
    it("treats no response and gateway / rate-limit statuses as transient", () => {
        for (const httpStatus of [0, 408, 429, 502, 503, 504]) expect(isTransientUploadError({ httpStatus })).toBe(true)
    })
    it("treats server verdicts and non-HTTP errors as final", () => {
        for (const httpStatus of [403, 413, 417, 500]) expect(isTransientUploadError({ httpStatus })).toBe(false)
        expect(isTransientUploadError(new Error("boom"))).toBe(false)
        expect(isTransientUploadError(undefined)).toBe(false)
    })
})

describe("automatic restart", () => {
    const noWait = { retryDelaysMs: [0, 0] }
    /** Records each call; the calls listed in `failures` throw the given error instead. */
    const flakySender = (failures: Record<number, unknown>) => {
        const calls: UploadFields[] = []
        const send: SendChunk<string> = async (_blob, fields, onLoaded) => {
            const call = calls.push(fields) - 1
            if (call in failures) throw failures[call]
            onLoaded(_blob.size)
            return `response-${call}`
        }
        return { calls, send }
    }

    it("restarts a chunked upload from the first chunk after a network error", async () => {
        const { calls, send } = flakySender({ 1: { httpStatus: 0 } })
        const outcome = await uploadInChunks(makeFile(25, "net.pdf"), 10, send, noWait)

        expect(calls.map((c) => c.chunk_index)).toEqual([0, 1, 0, 1, 2])
        expect(outcome).toEqual({ cancelled: false, result: "response-4" })
    })

    it("retries a single-request upload after a gateway error", async () => {
        const { calls, send } = flakySender({ 0: { httpStatus: 502 } })
        const outcome = await uploadInChunks(makeFile(5, "gw.pdf"), 10, send, noWait)

        expect(calls).toEqual([{ total_file_size: 5 }, { total_file_size: 5 }])
        expect(outcome).toEqual({ cancelled: false, result: "response-1" })
    })

    it("does not retry an error the server meant", async () => {
        const rejection = { httpStatus: 417, message: "File size exceeded" }
        const { calls, send } = flakySender({ 1: rejection })

        await expect(uploadInChunks(makeFile(25, "big.pdf"), 10, send, noWait)).rejects.toBe(rejection)
        expect(calls).toHaveLength(2)
    })

    it("gives up after three attempts with the last error", async () => {
        const down = { httpStatus: 503 }
        const { calls, send } = flakySender({ 0: down, 1: down, 2: down })

        await expect(uploadInChunks(makeFile(5, "down.pdf"), 10, send, noWait)).rejects.toBe(down)
        expect(calls).toHaveLength(3)
    })

    it("stops instead of retrying once the upload is no longer wanted", async () => {
        let wanted = true
        const { calls, send } = flakySender({ 0: { httpStatus: 0 } })
        const outcome = await uploadInChunks(makeFile(5, "gone.pdf"), 10, async (blob, fields, onLoaded) => {
            try { return await send(blob, fields, onLoaded) } finally { wanted = false }
        }, { ...noWait, shouldContinue: () => wanted })

        expect(calls).toHaveLength(1)
        expect(outcome).toEqual({ cancelled: true })
    })

    it("resets progress to zero when it restarts", async () => {
        const { send } = flakySender({ 1: { httpStatus: 0 } })
        const fractions: number[] = []
        await uploadInChunks(makeFile(20, "prog.pdf"), 10, send, { ...noWait, onProgress: (f) => fractions.push(f) })

        expect(fractions).toEqual([0.5, 0, 0.5, 1])
    })
})

describe("same-name uploads", () => {
    /** A sender that logs start/end per file and holds each send until its gate opens. */
    const gatedSender = () => {
        const order: string[] = []
        const gates = new Map<string, () => void>()
        const send = (label: string): SendChunk<string> => async (blob) => {
            order.push(`${label}:start`)
            await new Promise<void>((resolve) => gates.set(label, resolve))
            order.push(`${label}:end`)
            return blob.name
        }
        const open = (label: string) => gates.get(label)?.()
        return { order, send, open }
    }
    const flush = () => new Promise((r) => setTimeout(r, 0))

    it("runs chunked uploads with the same name one after another", async () => {
        const { order, send, open } = gatedSender()
        const first = uploadInChunks(makeFile(15, "image.png"), 10, send("a"))
        const second = uploadInChunks(makeFile(15, "image.png"), 10, send("b"))

        await flush()
        expect(order).toEqual(["a:start"])
        open("a"); await flush(); open("a"); await first
        await flush()
        expect(order.slice(-1)).toEqual(["b:start"])
        open("b"); await flush(); open("b"); await second
    })

    it("runs single-request uploads with the same name one after another", async () => {
        // Each request writes the same server temp file, so in parallel they corrupt each other.
        const { order, send, open } = gatedSender()
        const first = uploadInChunks(makeFile(5, "image.png"), 10, send("a"))
        const second = uploadInChunks(makeFile(5, "image.png"), 10, send("b"))

        await flush()
        expect(order).toEqual(["a:start"])
        open("a"); await first
        await flush()
        expect(order.slice(-1)).toEqual(["b:start"])
        open("b"); await second
    })

    it("runs the next chunked upload even when the previous one failed", async () => {
        const failing: SendChunk<string> = async () => { throw new Error("boom") }
        const { send } = recordingSender()
        const failed = uploadInChunks(makeFile(15, "image.png"), 10, failing)
        const next = uploadInChunks(makeFile(15, "image.png"), 10, send)

        await expect(failed).rejects.toThrow("boom")
        await expect(next).resolves.toEqual({ cancelled: false, result: "response-1" })
    })

    it("runs chunked uploads with different names at the same time", async () => {
        const { order, send, open } = gatedSender()
        const a = uploadInChunks(makeFile(15, "a.png"), 10, send("a"))
        const b = uploadInChunks(makeFile(15, "b.png"), 10, send("b"))

        await flush()
        expect(order).toEqual(["a:start", "b:start"])
        open("a"); open("b"); await flush(); open("a"); open("b")
        await Promise.all([a, b])
    })
})
