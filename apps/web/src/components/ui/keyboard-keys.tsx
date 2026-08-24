
export const KeyboardMetaKeyIcon = () => {
    return navigator.platform.startsWith("Mac") || navigator.platform === "iPhone"
        ? "⌘" // command key
        : "Ctrl"; // control key
}