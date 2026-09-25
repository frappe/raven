import "../index.css"

// Native entry. The app's modules are reached only from boot.tsx, after the site
// scope is set, because atoms with getOnInit read storage as they are created.
import("./boot").then(({ bootNative }) => bootNative())
