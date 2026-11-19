import type { CountryCode } from "libphonenumber-js/min"
import type { ContactField } from "./contact"

type Formatter = typeof import("libphonenumber-js/min")
let formatter: Promise<Formatter | null> | undefined

/** Starts loading the formatter, e.g. as the contact picker opens; a failed load leaves numbers as typed. */
export const preloadPhoneFormatter = (): Promise<Formatter | null> =>
    (formatter ??= import("libphonenumber-js/min").catch(() => {
        formatter = undefined
        return null
    }))

/** Valid numbers in international form with the sender's country (boot), as the server stores them; each value once. */
export const withCountryCodes = async (phones: ContactField[]): Promise<ContactField[]> => {
    const lib = await preloadPhoneFormatter()
    if (!lib) return phones
    const region = window.frappe?.boot?.raven_phone_region as CountryCode | undefined
    const seen = new Set<string>()
    return phones.flatMap((phone) => {
        const number = lib.parsePhoneNumberFromString(phone.value, region)
        const value = number?.isValid() ? number.formatInternational() : phone.value
        if (seen.has(value)) return []
        seen.add(value)
        return [{ ...phone, value }]
    })
}
