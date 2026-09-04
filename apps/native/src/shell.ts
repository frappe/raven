import { registerPlugin } from "@capacitor/core"
import type { RavenShellPlugin } from "@raven/lib/utils/ravenShell"

export const RavenShell = registerPlugin<RavenShellPlugin>("RavenShell")
