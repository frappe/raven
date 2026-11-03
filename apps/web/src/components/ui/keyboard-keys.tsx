import { isApple } from "@utils/platform"

export const KeyboardMetaKeyIcon = () => {
    return isApple
        ? "⌘" // command key
        : "Ctrl"; // control key
}