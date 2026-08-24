/**
 * Generates src/styles/espresso-typography.css from frappe-ui's canonical
 * typography definitions, so our Espresso type scale stays identical to
 * frappe-ui's.
 *
 *   Run: yarn gen:typography   (from apps/web)
 *
 * Source: frappe-ui/tailwind/generated/typography.json
 *   fontWeight  : named weights (regular = 420, …)
 *   fontSize    : each size as [size, { lineHeight, letterSpacing, fontWeight }]
 *   paragraph   : per-size looser line-height + letter-spacing for body copy
 *   tracking    : per-(size × weight) letter-spacing (text + paragraph)
 *   textTransform: per-size transform (only `tiny`, uppercase)
 *
 * Output:
 *   @theme            — font-weight tokens, the `--text-*` regular-weight scale
 *                       (size + line-height + letter-spacing + font-weight) and
 *                       the `--text-p-*` paragraph variants. The `--text-*`
 *                       namespace is reset so it replaces Tailwind's defaults.
 *   @layer components — the per-weight `.text-<size>-<weight>` and
 *                       `.text-p-<size>-<weight>` classes (letter-spacing tracks
 *                       per weight, which a fontSize tuple can't express), plus
 *                       the `tiny` uppercase eyebrow transform. This mirrors
 *                       frappe-ui's plugin buildTextStyleUtilities().
 *
 * Font families are NOT emitted here — raven's --font-sans / --font-numeric /
 * --font-mono are richer than frappe-ui's single text family and live in
 * src/index.css.
 */
import { writeFileSync } from "fs"

const SOURCE = "https://raw.githubusercontent.com/frappe/frappe-ui/main/tailwind/generated/typography.json"
const OUT = new URL("../src/styles/espresso-typography.css", import.meta.url)

const res = await fetch(SOURCE)
if (!res.ok) throw new Error(`Failed to fetch typography.json: ${res.status} ${res.statusText}`)
const t = await res.json()

// `regular` is the bare `text-<size>` utility; only these get component classes.
const WEIGHT_VARIANTS = ["medium", "semibold", "bold", "black"]

// --- @theme: font-weight tokens (additive; keep Tailwind's other weights) ---
const weights = Object.entries(t.fontWeight).map(([k, v]) => `  --font-weight-${k}: ${v};`)

// --- @theme: regular-weight size scale + paragraph variants ---
const sizeVars = []
const emitSize = (name, size, lineHeight, letterSpacing, fontWeight) => {
    sizeVars.push(`  --text-${name}: ${size};`)
    sizeVars.push(`  --text-${name}--line-height: ${lineHeight};`)
    sizeVars.push(`  --text-${name}--letter-spacing: ${letterSpacing};`)
    sizeVars.push(`  --text-${name}--font-weight: ${fontWeight};`)
}
for (const [key, [size, meta]] of Object.entries(t.fontSize)) {
    emitSize(key, size, meta.lineHeight, meta.letterSpacing, meta.fontWeight)
}
// Paragraph variants reuse the size's font-size + font-weight, with the
// paragraph style's looser line-height and its own letter-spacing.
for (const [key, p] of Object.entries(t.paragraph || {})) {
    const entry = t.fontSize[key]
    if (!entry) continue
    const [size, meta] = entry
    emitSize(`p-${key}`, size, p.lineHeight, p.letterSpacing, meta.fontWeight)
}

// --- @layer components: per-weight tracking classes ---
const groups = [
    { cls: (s, w) => `.text-${s}-${w}`, tracking: t.tracking?.text || {}, lineHeight: (s) => t.fontSize[s]?.[1].lineHeight },
    { cls: (s, w) => `.text-p-${s}-${w}`, tracking: t.tracking?.paragraph || {}, lineHeight: (s) => t.paragraph?.[s]?.lineHeight },
]
const rules = []
for (const group of groups) {
    for (const [size, byWeight] of Object.entries(group.tracking)) {
        const entry = t.fontSize[size]
        if (!entry) continue
        const [fontSize] = entry
        const lineHeight = group.lineHeight(size)
        const transform = t.textTransform?.[size]
        for (const weight of WEIGHT_VARIANTS) {
            if (!(weight in byWeight)) continue
            const decls = [
                `    font-size: ${fontSize};`,
                `    line-height: ${lineHeight};`,
                `    font-weight: ${t.fontWeight[weight]};`,
                `    letter-spacing: ${byWeight[weight]};`,
            ]
            if (transform) decls.push(`    text-transform: ${transform};`)
            rules.push(`  ${group.cls(size, weight)} {\n${decls.join("\n")}\n  }`)
        }
    }
}
// `tiny` is an uppercase eyebrow style; the bare regular utility needs the
// transform too (the fontSize tuple can't express text-transform).
for (const [size, transform] of Object.entries(t.textTransform || {})) {
    rules.push(`  .text-${size} {\n    text-transform: ${transform};\n  }`)
}

const out = `/* GENERATED from frappe-ui tailwind/generated/typography.json — do not hand-edit.
   Regenerate with: yarn gen:typography  (see scripts/generate-espresso-typography.mjs)

   frappe-ui's full type scale: font-weight tokens, the regular-weight --text-*
   scale (reset to replace Tailwind's defaults) + --text-p-* paragraph variants,
   and the per-weight .text-<size>-<weight> tracking classes. Font families are
   kept in src/index.css. */

@theme {
${weights.join("\n")}

  --text-*: initial;
${sizeVars.join("\n")}
}

@layer components {
${rules.join("\n\n")}
}
`

writeFileSync(OUT, out)
console.log(`Wrote ${OUT.pathname} — ${Object.keys(t.fontSize).length} sizes, ${rules.length} component classes`)
