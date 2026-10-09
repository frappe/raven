// Fire-and-forget; the dynamic import keeps @capacitor/haptics out of web bundles.
export const nativeHapticTick = () => {
    import("@capacitor/haptics")
        .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
        .catch(() => { })
}
