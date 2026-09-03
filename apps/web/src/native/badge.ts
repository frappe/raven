// Native icon-badge adapter. Dynamic import so browser bundles stay Capacitor-free.
export const setNativeBadge = (count: number): Promise<void> =>
    import("@capawesome/capacitor-badge")
        .then(({ Badge }) => (count > 0 ? Badge.set({ count }) : Badge.clear()))
        .catch(() => { })
