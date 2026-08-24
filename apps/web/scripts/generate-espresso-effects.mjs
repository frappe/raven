/**
 * Generates src/styles/espresso-effects.css from frappe-ui's canonical effect
 * definitions (elevations + focus rings), so our shadows and focus styles stay
 * identical to frappe-ui's.
 *
 *   Run: yarn gen:effects   (from apps/web)
 *
 * Source: frappe-ui/tailwind/generated/effects.json
 *   elevation.light / .dark : box-shadow stacks per step (sm…2xl)
 *   elevation.custom        : theme-independent shadows (e.g. status)
 *   focus.light / .dark     : single-layer focus-ring box-shadows per color
 *
 * Output mirrors frappe-ui's plugin (colorPalette.js#generateEffectVariables +
 * plugin.js#buildFocusRingUtilities):
 *   @theme inline      — `--shadow-*` utilities backed by the `--elevation-*` vars
 *                        (shadow / shadow-sm / …-2xl / shadow-status)
 *   :root              — `--elevation-*` (LIGHT values, used in BOTH modes — this
 *                        is deliberate in Espresso 2.0, dark mode does NOT swap
 *                        elevations) + light `--focus-*` / `--focus-outline-*`
 *   .dark              — focus rings only (mode-swapped); elevations intentionally
 *                        not overridden
 *   @layer components  — `.focus-ring` / `.focus-ring-<color>` (outline-based)
 *   :focus-visible     — global default focus ring
 *
 * raven's app-specific shadows (shadow-switch, shadow-chat-area, …) are NOT
 * emitted here — they live in src/index.css.
 */
import { writeFileSync } from "fs"

const SOURCE = "https://raw.githubusercontent.com/frappe/frappe-ui/main/tailwind/generated/effects.json"
const OUT = new URL("../src/styles/espresso-effects.css", import.meta.url)

const res = await fetch(SOURCE)
if (!res.ok) throw new Error(`Failed to fetch effects.json: ${res.status} ${res.statusText}`)
const fx = await res.json()

// Focus tokens are single-layer `0 0 0 <spread> <color>` shadows — re-express as
// an `outline` shorthand (`<spread> solid <color>`) so the focus ring uses
// outline, not box-shadow (no collisions with shadow utilities, survives
// forced-colors mode). Mirrors colorPalette.js#shadowToOutline.
const shadowToOutline = (shadow) => {
    const p = shadow.trim().split(/\s+/)
    return `${p[3]} solid ${p.slice(4).join(" ")}`
}

// @theme inline: `--shadow-*` utilities → the `--elevation-*` vars. `base`
// becomes the bare `--shadow` (Tailwind's `shadow` utility).
const shadowReg = []
for (const step of Object.keys(fx.elevation.light)) {
    shadowReg.push(step === "base" ? `  --shadow: var(--elevation-base);` : `  --shadow-${step}: var(--elevation-${step});`)
}
for (const name of Object.keys(fx.elevation.custom)) {
    shadowReg.push(`  --shadow-${name}: var(--elevation-${name});`)
}

// :root elevations — light values, in both modes (no dark override).
const elevations = [
    ...Object.entries(fx.elevation.light).map(([k, v]) => `  --elevation-${k}: ${v};`),
    ...Object.entries(fx.elevation.custom).map(([k, v]) => `  --elevation-${k}: ${v};`),
]

// Focus vars (raw shadow value + outline form), per mode.
const focusVars = (mode) =>
    Object.entries(fx.focus[mode])
        .flatMap(([name, v]) => [`  --focus-${name}: ${v};`, `  --focus-outline-${name}: ${shadowToOutline(v)};`])
        .join("\n")

// focus-ring / focus-ring-<color> as Tailwind v4 @utility (default → focus-ring).
// They MUST be real utilities (not @layer components) so variants like
// `focus-visible:focus-ring-red` generate AND land in the utilities layer,
// letting them override the global :focus-visible ring (which sits in @layer
// base below). Authored @layer-components classes can't be variant-prefixed.
const focusRing = Object.keys(fx.focus.light)
    .map((name) => {
        const util = name === "default" ? "focus-ring" : `focus-ring-${name}`
        return `@utility ${util} {\n  outline: var(--focus-outline-${name});\n  outline-offset: 0px;\n}`
    })
    .join("\n\n")

const out = `/* GENERATED from frappe-ui tailwind/generated/effects.json — do not hand-edit.
   Regenerate with: yarn gen:effects  (see scripts/generate-espresso-effects.mjs)

   Elevations (--elevation-* / shadow utilities) and focus rings (--focus-* /
   --focus-outline-* / .focus-ring*). Elevations use the LIGHT values in both
   modes (deliberate in Espresso 2.0). App-specific shadows are kept in
   src/index.css. */

@theme inline {
${shadowReg.join("\n")}
}

:root {
${elevations.join("\n")}

${focusVars("light")}
}

.dark {
${focusVars("dark")}
}

${focusRing}

/* Global default focus ring (frappe-ui applies this to every focusable element
   via :focus-visible). Kept in @layer base so utilities override it — suppress
   with focus-visible:outline-none, retheme with focus-visible:focus-ring-<color>. */
@layer base {
  :focus-visible {
    outline: var(--focus-outline-default);
  }
}
`

writeFileSync(OUT, out)
console.log(`Wrote ${OUT.pathname} — ${elevations.length} elevations, ${Object.keys(fx.focus.light).length} focus colors`)
