import type { ContactField, ContactPayload } from "@lib/contact"
import { nativePlatform, nativePlugin } from "./platform"

export type NativeContact = {
    name: string
    phones: ContactField[]
    emails: ContactField[]
    /** Base64 JPEG, without a data-URL prefix. */
    photo?: string
}

export type RavenContactsPlugin = {
    pickContact(options?: { field?: "phone" | "email" }): Promise<{ contact?: NativeContact }>
    saveContact(options: {
        name: string
        phones: ContactField[]
        emails: ContactField[]
        photo?: string
    }): Promise<void>
}

export type PickedContact = ContactPayload & { photo?: Blob | string }

export const ravenContacts = nativePlugin<RavenContactsPlugin>("RavenContacts")

/** Android has no combined contact picker: the user picks phone or email first. */
export const needsFieldChoice = (): boolean => nativePlatform() === "android"

const textValues = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []

/** Trimmed, non-blank fields with each value once; a label is kept only when it is text. */
const uniqueFields = (items: { value: unknown; label?: unknown }[]): ContactField[] => {
    const seen = new Set<string>()
    const fields: ContactField[] = []
    for (const item of items) {
        const value = typeof item.value === "string" ? item.value.trim() : ""
        if (!value || seen.has(value)) continue
        seen.add(value)
        const label = typeof item.label === "string" ? item.label.trim() : ""
        fields.push(label ? { value, label } : { value })
    }
    return fields
}

const nativeFields = (value: unknown): ContactField[] =>
    Array.isArray(value) ? uniqueFields(value.filter((item) => !!item && typeof item === "object")) : []

const fromWeb = (raw: Record<string, unknown>): PickedContact => {
    const phones = uniqueFields(textValues(raw.tel).map((value) => ({ value })))
    const emails = uniqueFields(textValues(raw.email).map((value) => ({ value })))
    const names = textValues(raw.name).map((name) => name.trim()).filter(Boolean)
    const name = names[0] ?? phones[0]?.value ?? emails[0]?.value ?? ""
    const icon = Array.isArray(raw.icon) ? raw.icon.find((item): item is Blob => item instanceof Blob) : undefined
    return { name, phones, emails, ...(icon ? { photo: icon } : {}) }
}

const fromNative = (raw: Record<string, unknown>): PickedContact => {
    const phones = nativeFields(raw.phones)
    const emails = nativeFields(raw.emails)
    const name = (typeof raw.name === "string" ? raw.name.trim() : "") || phones[0]?.value || emails[0]?.value || ""
    const photo = typeof raw.photo === "string" && raw.photo ? raw.photo : undefined
    return { name, phones, emails, ...(photo ? { photo } : {}) }
}

/** The web picker's arrays or the native plugin's labelled fields, as one payload. */
export const normalizePicked = (raw: unknown): PickedContact | null => {
    if (!raw || typeof raw !== "object") return null
    const value = raw as Record<string, unknown>
    const isWeb = Array.isArray(value.name) || Array.isArray(value.tel) || Array.isArray(value.email)
    const contact = isWeb ? fromWeb(value) : fromNative(value)
    return contact.phones.length || contact.emails.length ? contact : null
}

type WebContactsManager = {
    select(properties: string[], options?: { multiple?: boolean }): Promise<Record<string, unknown>[]>
}

const webContacts = (): WebContactsManager | undefined =>
    (navigator as Navigator & { contacts?: WebContactsManager }).contacts

export type PickResult =
    | { status: "picked"; contact: PickedContact }
    | { status: "empty"; name: string }
    | { status: "cancelled" | "failed" }

const rawName = (raw: unknown): string => {
    const name = (raw as { name?: unknown }).name
    const first = Array.isArray(name) ? name[0] : name
    return typeof first === "string" ? first.trim() : ""
}

/** Cancel resolves nothing; a contact with no phone or email is "empty" so the user hears why. */
const toResult = (raw: unknown): PickResult => {
    if (!raw) return { status: "cancelled" }
    const contact = normalizePicked(raw)
    return contact ? { status: "picked", contact } : { status: "empty", name: rawName(raw) }
}

/** A contact from the device picker. */
export const pickContact = async (field?: "phone" | "email"): Promise<PickResult> => {
    try {
        if (nativePlatform() !== "web") {
            const { plugin } = await ravenContacts()
            // An empty native resolve arrives as undefined, not {}: that is still a cancel.
            return toResult((await plugin.pickContact({ field }))?.contact)
        }
        const contacts = webContacts()
        if (!contacts) return { status: "failed" }
        const [raw] = await contacts.select(["name", "tel", "email", "icon"], { multiple: false })
        return toResult(raw)
    } catch {
        return { status: "failed" }
    }
}

const blobBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "")
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
    })

/** The photo as base64, or undefined: a missing photo never blocks saving the contact. */
const photoBase64 = async (photoUrl: string): Promise<string | undefined> => {
    const response = await fetch(photoUrl)
    return response.ok ? blobBase64(await response.blob()) : undefined
}

/** Writes the contact to the phone's address book, with its photo when the message has one. */
export const saveContact = async (contact: ContactPayload, photoUrl?: string): Promise<void> => {
    const photo = photoUrl ? await photoBase64(photoUrl).catch(() => undefined) : undefined
    const { plugin } = await ravenContacts()
    await plugin.saveContact({
        name: contact.name,
        phones: contact.phones,
        emails: contact.emails,
        ...(photo ? { photo } : {}),
    })
}
