import { hasNativePlugin, isNative } from "../native/platform"

let canShare: boolean | undefined

/** The device exposes a contact picker. */
export const canShareContact = (): boolean => {
    canShare ??= isNative()
        ? hasNativePlugin("RavenContacts")
        : "contacts" in navigator && "ContactsManager" in window
    return canShare
}
