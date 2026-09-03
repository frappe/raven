import { App } from "@capacitor/app"
// Picker is the root screen: Android back leaves the app.
export const registerPickerBack = () => App.addListener("backButton", () => App.exitApp())
