/**
 * UUID v4 that also works on INSECURE origins. crypto.randomUUID only exists
 * in secure contexts (https / localhost) — on LAN-IP dev (http://192.168.…)
 * it's undefined, which crashed attach + send the moment they minted an id.
 * crypto.getRandomValues has no such restriction, so the fallback assembles
 * the v4 by hand from the same entropy.
 */
export const randomUUID = (): string => {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10xx
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
