// The native splash stays up until the page has rendered; hide it unconditionally
// so an error screen is never stuck behind it.
export const hideNativeSplash = () => {
    import("@capacitor/splash-screen").then(({ SplashScreen }) => SplashScreen.hide()).catch(() => { })
}
