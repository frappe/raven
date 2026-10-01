import { describe, expect, it } from "vitest"
import { base64Url, codeChallengeS256, randomString } from "./pkce"

describe("randomString", () => {
    it("is base64url of the requested byte length", () => {
        const s = randomString(32)
        expect(s.length).toBe(43) // 44 base64 chars minus one padding '='
        expect(s).toMatch(/^[A-Za-z0-9_-]+$/)
    })
    it("differs across calls", () => {
        expect(randomString(32)).not.toBe(randomString(32))
    })
})

describe("codeChallengeS256", () => {
    it("matches the RFC 7636 test vector", async () => {
        const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
        await expect(codeChallengeS256(verifier)).resolves.toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
    })
})

describe("base64Url", () => {
    it("encodes bytes without padding or url-unsafe chars", () => {
        const buf = new Uint8Array([0xfb, 0xff, 0xef]) // base64: +//v
        expect(base64Url(buf)).toBe("-__v")
    })
})
