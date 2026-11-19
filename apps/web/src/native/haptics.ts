import type { HapticKind } from "@utils/haptics"
import { nativePlatform } from "./platform"
import { ravenShell } from "./shell"

// Fire-and-forget; the dynamic import keeps @capacitor/haptics out of web bundles.
export const nativeHapticTick = (kind: HapticKind) => {
    // Android: the shell's own effects; the plugin's Android patterns don't match iOS's meanings.
    if (nativePlatform() === "android") {
        ravenShell().then(({ plugin }) => plugin.haptic({ kind })).catch(() => { })
        return
    }
    import("@capacitor/haptics")
        .then(({ Haptics, ImpactStyle, NotificationType }) => {
            const play: Record<HapticKind, () => Promise<void>> = {
                light: () => Haptics.impact({ style: ImpactStyle.Light }),
                medium: () => Haptics.impact({ style: ImpactStyle.Medium }),
                heavy: () => Haptics.impact({ style: ImpactStyle.Heavy }),
                success: () => Haptics.notification({ type: NotificationType.Success }),
                warning: () => Haptics.notification({ type: NotificationType.Warning }),
                error: () => Haptics.notification({ type: NotificationType.Error }),
            }
            return play[kind]()
        })
        .catch(() => { })
}
