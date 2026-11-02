import { beforeEach, describe, expect, it, vi } from "vitest"
import type { OutboxMessage } from "@db"
import { buildOptimisticMessages, enqueueSend, injectOutboxRecord, retryOutboxRecord, retrySend, submitSend } from "./messageSender"

const mocks = vi.hoisted(() => ({
    getOptimisticMessages: vi.fn(),
    addOptimisticMessages: vi.fn(),
    retryOptimisticSend: vi.fn(),
    resolveOptimisticSend: vi.fn(),
    getOutbox: vi.fn(),
    putOutbox: vi.fn(),
    setOutboxStatus: vi.fn(),
    markRead: vi.fn(),
}))

vi.mock("@lib/location", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@lib/location")>()
    return { ...actual, senderMapsProvider: () => "google" }
})

vi.mock("./store", () => ({
    channelMessagesStore: {
        getOptimisticMessages: mocks.getOptimisticMessages,
        addOptimisticMessages: mocks.addOptimisticMessages,
        retryOptimisticSend: mocks.retryOptimisticSend,
        resolveOptimisticSend: mocks.resolveOptimisticSend,
    },
}))

vi.mock("./outbox", () => ({
    putOutbox: mocks.putOutbox,
    removeOutbox: vi.fn(),
    setOutboxStatus: mocks.setOutboxStatus,
    isSettling: () => false,
    getOutbox: mocks.getOutbox,
}))

vi.mock("@stores/unread/store", () => ({
    channelUnreadStore: { markRead: mocks.markRead },
}))

const CREATION = "2026-10-23 10:00:00.000000"

const SNAPSHOT = { file_url: "/private/files/location.webp", file_size: 900 }
const CONTACT = { name: "Priya Sharma", phones: [{ value: "+91 98200 41234", label: "Mobile" }], emails: [] }
const PHOTO = { file_url: "/private/files/contact.jpg", file_size: 3000 }

const outboxRecord = (overrides: Partial<OutboxMessage> = {}): OutboxMessage => ({
    client_id: "b",
    channel_id: "ch",
    owner: "me",
    content: "",
    files: [SNAPSHOT],
    creation: CREATION,
    status: "sending",
    queued_at: 1,
    location: { latitude: 1, longitude: 2 },
    ...overrides,
})

beforeEach(() => {
    vi.clearAllMocks()
    mocks.getOptimisticMessages.mockReturnValue([])
    mocks.getOutbox.mockResolvedValue(undefined)
})

describe("buildOptimisticMessages", () => {
    it("builds a Voice placeholder for a file carrying voice metadata", () => {
        const voice = { duration: 7.25, waveform: [0, 50, 100] }
        const [message] = buildOptimisticMessages("ch", "batch", "me", "", [{ file_url: "/private/files/v.m4a", file_size: 10, voice }], CREATION)
        expect(message).toMatchObject({ message_type: "Voice", json: voice, file: "/private/files/v.m4a", _status: "sending" })
    })

    it("keeps a plain audio file as a File placeholder", () => {
        const [message] = buildOptimisticMessages("ch", "batch", "me", "", [{ file_url: "/private/files/a.m4a", file_size: 10 }], CREATION)
        expect(message.message_type).toBe("File")
        expect("json" in message).toBe(false)
    })

    it("builds one Location placeholder carrying the reply", () => {
        const location = { latitude: 1, longitude: 2 }
        const messages = buildOptimisticMessages("ch", "b", "me", "", [], CREATION, { linkedMessage: "m1" }, undefined, location)
        expect(messages).toHaveLength(1)
        expect(messages[0]).toMatchObject({ name: "b-location", message_type: "Location", json: location, is_reply: 1, linked_message: "m1", _status: "sending" })
    })

    it("puts the snapshot on the Location placeholder", () => {
        const [m] = buildOptimisticMessages("ch", "b", "me", "", [{ file_url: "/private/files/location.webp", file_size: 900 }], CREATION, undefined, undefined, { latitude: 1, longitude: 2 })
        expect(m).toMatchObject({ message_type: "Location", file: "/private/files/location.webp", file_size: 900 })
    })

    it("sends a Location without a snapshot", () => {
        const [m] = buildOptimisticMessages("ch", "b", "me", "", [], CREATION, undefined, undefined, { latitude: 1, longitude: 2 })
        expect(m.message_type).toBe("Location")
        expect("file" in m).toBe(false)
    })

    it("keeps an older-site fallback as plain text", () => {
        const [m] = buildOptimisticMessages("ch", "b", "me", '<p><a href="https://maps.apple.com/?ll=1,2&amp;q=Location">x</a></p>', [], CREATION)
        expect(m.message_type).toBe("Text")
    })

    it("builds one Contact placeholder carrying the reply", () => {
        const messages = buildOptimisticMessages("ch", "b", "me", "", [], CREATION, { linkedMessage: "m1" }, undefined, undefined, CONTACT)
        expect(messages).toHaveLength(1)
        expect(messages[0]).toMatchObject({ name: "b-contact", message_type: "Contact", json: CONTACT, is_reply: 1, linked_message: "m1", _status: "sending" })
    })

    it("puts the photo on the Contact placeholder", () => {
        const [m] = buildOptimisticMessages("ch", "b", "me", "", [PHOTO], CREATION, undefined, undefined, undefined, CONTACT)
        expect(m).toMatchObject({ message_type: "Contact", file: PHOTO.file_url, file_size: PHOTO.file_size })
    })

    it("sends a Contact without a photo", () => {
        const [m] = buildOptimisticMessages("ch", "b", "me", "", [], CREATION, undefined, undefined, undefined, CONTACT)
        expect(m.message_type).toBe("Contact")
        expect("file" in m).toBe(false)
    })
})

describe("retrySend", () => {
    it("rebuilds a Location and sends its snapshot as a plain file", async () => {
        mocks.getOptimisticMessages.mockReturnValue([
            { message_type: "Location", json: { latitude: 1, longitude: 2 }, file: SNAPSHOT.file_url, file_size: SNAPSHOT.file_size },
        ])
        const post = vi.fn().mockResolvedValue({ message: [] })

        await retrySend({ post }, "ch", "b")

        expect(post).toHaveBeenCalledWith(
            "raven.api.raven_message.send_message_with_attachments",
            expect.objectContaining({
                location: { latitude: 1, longitude: 2, maps: "google" },
                files: [SNAPSHOT],
            }),
        )
    })

    it("sends a Location without a snapshot as an empty file list", async () => {
        mocks.getOptimisticMessages.mockReturnValue([{ message_type: "Location", json: { latitude: 1, longitude: 2 } }])
        const post = vi.fn().mockResolvedValue({ message: [] })

        await retrySend({ post }, "ch", "b")

        expect(post).toHaveBeenCalledWith(
            "raven.api.raven_message.send_message_with_attachments",
            expect.objectContaining({ location: { latitude: 1, longitude: 2, maps: "google" }, files: [] }),
        )
    })

    it("falls back to the saved location when the placeholder json is junk", async () => {
        mocks.getOptimisticMessages.mockReturnValue([{ message_type: "Location", json: "not-json" }])
        mocks.getOutbox.mockResolvedValue(outboxRecord())
        const post = vi.fn().mockResolvedValue({ message: [] })

        await retrySend({ post }, "ch", "b")

        expect(post).toHaveBeenCalledWith(
            "raven.api.raven_message.send_message_with_attachments",
            expect.objectContaining({ location: { latitude: 1, longitude: 2, maps: "google" }, files: [] }),
        )
    })

    it("rebuilds a Contact and sends its photo as a plain file", async () => {
        mocks.getOptimisticMessages.mockReturnValue([
            { message_type: "Contact", json: CONTACT, file: PHOTO.file_url, file_size: PHOTO.file_size },
        ])
        const post = vi.fn().mockResolvedValue({ message: [] })

        await retrySend({ post }, "ch", "b")

        expect(post).toHaveBeenCalledWith(
            "raven.api.raven_message.send_message_with_attachments",
            expect.objectContaining({ contact: CONTACT, files: [PHOTO] }),
        )
    })

    it("sends a Contact without a photo as an empty file list", async () => {
        mocks.getOptimisticMessages.mockReturnValue([{ message_type: "Contact", json: CONTACT }])
        const post = vi.fn().mockResolvedValue({ message: [] })

        await retrySend({ post }, "ch", "b")

        expect(post).toHaveBeenCalledWith(
            "raven.api.raven_message.send_message_with_attachments",
            expect.objectContaining({ contact: CONTACT, files: [] }),
        )
    })

    it("never degrades an unrecoverable card into a plain image send", async () => {
        for (const type of ["Contact", "Location"]) {
            mocks.getOptimisticMessages.mockReturnValue([
                { message_type: type, json: "not-json", file: PHOTO.file_url, file_size: PHOTO.file_size },
            ])
            const post = vi.fn().mockResolvedValue({ message: [] })

            await retrySend({ post }, "ch", "b")

            expect(post).not.toHaveBeenCalled()
        }
    })

    it("falls back to the saved contact when the placeholder json is junk", async () => {
        mocks.getOptimisticMessages.mockReturnValue([{ message_type: "Contact", json: "not-json" }])
        mocks.getOutbox.mockResolvedValue(outboxRecord({ location: undefined, contact: CONTACT }))
        const post = vi.fn().mockResolvedValue({ message: [] })

        await retrySend({ post }, "ch", "b")

        expect(post).toHaveBeenCalledWith(
            "raven.api.raven_message.send_message_with_attachments",
            expect.objectContaining({ contact: CONTACT, files: [] }),
        )
    })
})

describe("submitSend", () => {
    it("posts the contact and its photo", async () => {
        const post = vi.fn().mockResolvedValue({ message: [] })

        await submitSend({ post }, "ch", "b", "", [PHOTO], undefined, { contact: CONTACT })

        expect(post).toHaveBeenCalledWith(
            "raven.api.raven_message.send_message_with_attachments",
            expect.objectContaining({ contact: CONTACT, files: [PHOTO] }),
        )
    })
})

describe("injectOutboxRecord", () => {
    it("puts the saved location back as a Location placeholder with its snapshot", () => {
        injectOutboxRecord(outboxRecord())

        expect(mocks.addOptimisticMessages).toHaveBeenCalledWith("ch", "b", [
            expect.objectContaining({ message_type: "Location", json: { latitude: 1, longitude: 2 }, file: SNAPSHOT.file_url, file_size: SNAPSHOT.file_size }),
        ])
    })

    it("puts the saved contact back as a Contact placeholder with its photo", () => {
        injectOutboxRecord(outboxRecord({ location: undefined, contact: CONTACT, files: [PHOTO] }))

        expect(mocks.addOptimisticMessages).toHaveBeenCalledWith("ch", "b", [
            expect.objectContaining({ message_type: "Contact", json: CONTACT, file: PHOTO.file_url, file_size: PHOTO.file_size }),
        ])
    })
})

describe("retryOutboxRecord", () => {
    it("re-sends a saved location with its snapshot", async () => {
        const post = vi.fn().mockResolvedValue({ message: [] })

        await retryOutboxRecord({ post }, outboxRecord())

        expect(mocks.addOptimisticMessages).toHaveBeenCalledWith("ch", "b", [
            expect.objectContaining({ message_type: "Location", json: { latitude: 1, longitude: 2 }, file: SNAPSHOT.file_url, file_size: SNAPSHOT.file_size }),
        ])
        expect(post).toHaveBeenCalledWith(
            "raven.api.raven_message.send_message_with_attachments",
            expect.objectContaining({ location: { latitude: 1, longitude: 2, maps: "google" }, files: [SNAPSHOT] }),
        )
    })

    it("re-sends a saved contact with its photo", async () => {
        const post = vi.fn().mockResolvedValue({ message: [] })

        await retryOutboxRecord({ post }, outboxRecord({ location: undefined, contact: CONTACT, files: [PHOTO] }))

        expect(mocks.addOptimisticMessages).toHaveBeenCalledWith("ch", "b", [
            expect.objectContaining({ message_type: "Contact", json: CONTACT, file: PHOTO.file_url, file_size: PHOTO.file_size }),
        ])
        expect(post).toHaveBeenCalledWith(
            "raven.api.raven_message.send_message_with_attachments",
            expect.objectContaining({ contact: CONTACT, files: [PHOTO] }),
        )
    })
})

describe("enqueueSend", () => {
    it("saves the location on the outbox record", () => {
        const post = vi.fn().mockResolvedValue({ message: [] })

        enqueueSend(
            { post },
            { channelID: "ch", batchId: "b", owner: "me", content: "", files: [SNAPSHOT], location: { latitude: 1, longitude: 2 } },
        )

        expect(mocks.putOutbox).toHaveBeenCalledWith(expect.objectContaining({ location: { latitude: 1, longitude: 2 } }))
        expect(mocks.addOptimisticMessages).toHaveBeenCalledWith("ch", "b", [
            expect.objectContaining({ message_type: "Location", json: { latitude: 1, longitude: 2 }, file: SNAPSHOT.file_url, file_size: SNAPSHOT.file_size }),
        ])
    })

    it("saves the contact on the outbox record and posts it with its photo", () => {
        const post = vi.fn().mockResolvedValue({ message: [] })

        enqueueSend({ post }, { channelID: "ch", batchId: "b", owner: "me", content: "", files: [PHOTO], contact: CONTACT })

        expect(mocks.putOutbox).toHaveBeenCalledWith(expect.objectContaining({ contact: CONTACT }))
        expect(mocks.addOptimisticMessages).toHaveBeenCalledWith("ch", "b", [
            expect.objectContaining({ message_type: "Contact", json: CONTACT, file: PHOTO.file_url, file_size: PHOTO.file_size }),
        ])
        expect(post).toHaveBeenCalledWith(
            "raven.api.raven_message.send_message_with_attachments",
            expect.objectContaining({ contact: CONTACT, files: [PHOTO] }),
        )
    })
})
