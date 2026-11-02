import type { ContactField } from "./contact"

export type ParsedVCard = { name: string; phones: ContactField[]; emails: ContactField[]; photo?: string }

/** `params` holds every parameter value as one uppercase token: TYPE=CELL,VOICE → CELL, VOICE; bare CELL → CELL. */
type Property = { group?: string; name: string; params: Set<string>; value: string }

const TYPE_LABELS: Record<string, string> = {
    CELL: "Mobile",
    MOBILE: "Mobile",
    IPHONE: "Mobile",
    HOME: "Home",
    WORK: "Work",
    MAIN: "Main",
    OTHER: "Other",
}

/** vCard MIME types plus any `.vcf` name; a share can leave the type blank. */
export const isVCardFile = (file: File): boolean =>
    ["text/vcard", "text/x-vcard", "text/directory"].includes(file.type.split(";")[0].trim().toLowerCase()) ||
    file.name.toLowerCase().endsWith(".vcf")

/** Split on `separator` outside double quotes, keeping every piece. */
const splitOutsideQuotes = (value: string, separator: string): string[] => {
    const parts: string[] = []
    let current = ""
    let quoted = false
    for (const character of value) {
        if (character === '"') quoted = !quoted
        if (character === separator && !quoted) {
            parts.push(current)
            current = ""
        } else current += character
    }
    parts.push(current)
    return parts
}

/** A folded line drops its one leading space or tab; a quoted-printable soft break drops the `=` and at most one indent. */
const logicalLines = (text: string): string[] => {
    const lines: string[] = []
    for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
        const last = lines.length - 1
        if (last >= 0 && lines[last].endsWith("=") && /ENCODING=QUOTED-PRINTABLE/i.test(lines[last])) {
            lines[last] = lines[last].slice(0, -1) + line.replace(/^[ \t]/, "")
        } else if (last >= 0 && /^[ \t]/.test(line)) {
            lines[last] += line.slice(1)
        } else {
            lines.push(line)
        }
    }
    return lines
}

const decodeQuotedPrintable = (value: string): string => {
    const encoder = new TextEncoder()
    const bytes: number[] = []
    for (let index = 0; index < value.length; index++) {
        const hex = value.slice(index + 1, index + 3)
        if (value[index] === "=" && /^[0-9A-Fa-f]{2}$/.test(hex)) {
            bytes.push(parseInt(hex, 16))
            index += 2
        } else bytes.push(...encoder.encode(value[index]))
    }
    return new TextDecoder().decode(new Uint8Array(bytes))
}

const unescapeText = (value: string): string =>
    value.replace(/\\([\\,;nN])/g, (_, character: string) => (character.toLowerCase() === "n" ? "\n" : character))

const paramTokens = (raw: string): string[] => {
    const value = raw.includes("=") ? raw.slice(raw.indexOf("=") + 1) : raw
    return value.replace(/"/g, "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean)
}

/** Index of the first `:` outside quotes; a photo's long value is never scanned. */
const valueStart = (line: string): number => {
    let quoted = false
    for (let index = 0; index < line.length; index++) {
        if (line[index] === '"') quoted = !quoted
        else if (line[index] === ":" && !quoted) return index
    }
    return -1
}

const parseProperty = (line: string): Property | undefined => {
    const colon = valueStart(line)
    if (colon < 0) return undefined
    const [rawName, ...rawParams] = splitOutsideQuotes(line.slice(0, colon), ";")
    const group = /^(item\d+)\.(.+)$/i.exec(rawName.trim())
    const params = new Set(rawParams.flatMap(paramTokens))
    const quoted = params.has("QUOTED-PRINTABLE")
    const value = line.slice(colon + 1)
    return {
        group: group?.[1].toLowerCase(),
        name: (group?.[2] ?? rawName).trim().toUpperCase(),
        params,
        value: quoted ? decodeQuotedPrintable(value) : value,
    }
}

const propertyLabel = (property: Property, custom: Map<string, string>): string | undefined => {
    if (property.group && custom.has(property.group)) return custom.get(property.group)
    return [...property.params].map((token) => TYPE_LABELS[token]).find(Boolean)
}

const field = (property: Property, custom: Map<string, string>): ContactField | undefined => {
    const raw = unescapeText(property.value).trim()
    const value = property.name === "TEL" ? raw.replace(/^tel:/i, "") : raw.replace(/^mailto:/i, "")
    if (!value) return undefined
    const label = propertyLabel(property, custom)
    return label ? { value, label } : { value }
}

// Split on unescaped `;` only (no lookbehind: older iOS WebViews reject it).
const nameFromN = (value: string): string => {
    const parts = value.replace(/\\;/g, "\u0000").split(";").map((part) => part.replace(/\u0000/g, "\\;"))
    const given = unescapeText(parts[1] ?? "").trim()
    const family = unescapeText(parts[0] ?? "").trim()
    return [given, family].filter(Boolean).join(" ")
}

const photoBase64 = (property: Property): string | undefined => {
    const value = property.value.trim()
    if (!value) return undefined
    if (/^data:/i.test(value)) {
        const marker = value.toLowerCase().indexOf("base64,")
        return marker < 0 ? undefined : value.slice(marker + 7).replace(/\s+/g, "")
    }
    const encoded = property.params.has("B") || property.params.has("BASE64")
    return encoded ? value.replace(/\s+/g, "") : undefined
}

const toCard = (properties: Property[]): ParsedVCard => {
    const custom = new Map<string, string>()
    for (const property of properties) {
        if (property.name !== "X-ABLABEL" || !property.group) continue
        const label = unescapeText(property.value).trim().replace(/^_\$!<(.*)>!\$_$/, "$1")
        if (label) custom.set(property.group, label)
    }
    const find = (name: string) => properties.find((property) => property.name === name)
    const fn = find("FN")
    const n = find("N")
    const photoProperty = find("PHOTO")
    const photo = photoProperty && photoBase64(photoProperty)
    const fullName = fn ? unescapeText(fn.value).trim() : ""
    const fields = (name: string) =>
        properties
            .filter((property) => property.name === name)
            .map((property) => field(property, custom))
            .filter((item): item is ContactField => !!item)
    return {
        name: fullName || (n ? nameFromN(n.value) : ""),
        phones: fields("TEL"),
        emails: fields("EMAIL"),
        ...(photo ? { photo } : {}),
    }
}

/** Every card in a .vcf, in file order; cards with no phone or email are left for the caller. */
export const parseVCards = (text: string): ParsedVCard[] => {
    const cards: Property[][] = []
    let current: Property[] | undefined
    for (const line of logicalLines(text)) {
        if (!line.trim()) continue
        const property = parseProperty(line)
        if (!property) continue
        if (property.name === "BEGIN") current = []
        else if (property.name === "END") {
            if (current) cards.push(current)
            current = undefined
        } else current?.push(property)
    }
    return cards.map(toCard)
}
