/**
 * Generates src/styles/espresso-colors.css from frappe-ui's canonical color
 * definitions, so our Espresso tokens stay identical to frappe-ui's.
 *
 *   Run: yarn gen:colors   (from apps/web)
 *
 * Source: frappe-ui/tailwind/generated/colors.json — five sections:
 *   lightMode / darkMode : raw palette (gray, blue, … 50→950)
 *   overlay              : alpha black/white
 *   neutral              : white / black / transparent
 *   themedVariables      : semantic layer (surface / surface-alpha / ink /
 *                          outline / outline-alpha) referencing the palette
 *
 * Output is the base palette + overlay + neutral (in :root / .dark) and the
 * semantic layer, plus the `@theme inline` registrations Tailwind needs. The
 * handful of app-specific tokens frappe-ui doesn't define (surface-white,
 * ink-white, outline-white, outline-gray-modals, surface-cards/menu-bar/
 * modal/selected) are NOT emitted here — they live in src/index.css until
 * components migrate to the canonical token names.
 */
import { writeFileSync } from "fs"

const SOURCE = "https://raw.githubusercontent.com/frappe/frappe-ui/main/tailwind/generated/colors.json"
const OUT = new URL("../src/styles/espresso-colors.css", import.meta.url)

const res = await fetch(SOURCE)
if (!res.ok) throw new Error(`Failed to fetch colors.json: ${res.status} ${res.statusText}`)
const c = await res.json()

/** "lightMode/gray/50" → var(--gray-50); "neutral/white" → var(--white). */
const ref = (v) => {
    const p = v.split("/")
    return p[0] === "neutral" ? `var(--${p[1]})` : `var(--${p[1]}-${p[2]})`
}

// @theme --color-* registrations (one per token, so Tailwind emits utilities)
const reg = []
const seen = new Set()
const addReg = (n) => {
    if (seen.has(n)) return
    seen.add(n)
    reg.push(`  --color-${n}: var(--${n});`)
}

// palette families — union of light+dark steps (dark gray adds 450, etc.)
const fams = {}
for (const mode of ["lightMode", "darkMode"]) {
    for (const [fam, steps] of Object.entries(c[mode])) {
        fams[fam] ??= new Set()
        Object.keys(steps).forEach((s) => fams[fam].add(s))
    }
}
for (const fam of Object.keys(fams)) {
    for (const s of [...fams[fam]].sort((a, b) => +a - +b)) addReg(`${fam}-${s}`)
}
addReg("white")
addReg("black")
addReg("transparent")
for (const t of ["white", "black"]) for (const s of Object.keys(c.overlay[t])) addReg(`${t}-${s}`)
for (const sec of Object.keys(c.themedVariables.light)) {
    for (const k of Object.keys(c.themedVariables.light[sec])) addReg(`${sec}-${k}`)
}

const emitPalette = (mode) =>
    Object.entries(c[mode])
        .flatMap(([fam, steps]) => Object.entries(steps).map(([s, hex]) => `  --${fam}-${s}: ${hex};`))
        .join("\n")
const emitSem = (mode) =>
    Object.entries(c.themedVariables[mode])
        .flatMap(([sec, obj]) => Object.entries(obj).map(([k, v]) => `  --${sec}-${k}: ${ref(v)};`))
        .join("\n")
const emitOverlay = () =>
    ["white", "black"]
        .flatMap((t) => Object.entries(c.overlay[t]).map(([s, hex]) => `  --${t}-${s}: ${hex};`))
        .join("\n")
const emitNeutral = () =>
    `  --white: ${c.neutral.white};\n  --black: ${c.neutral.black};\n  --transparent: ${c.neutral.transparent};`

const out = `/* GENERATED from frappe-ui tailwind/generated/colors.json — do not hand-edit.
   Regenerate with: yarn gen:colors  (see scripts/generate-espresso-colors.mjs)

   Base palette + overlay + neutral, and the Espresso semantic layer
   (surface / surface-alpha / ink / outline / outline-alpha). App-specific tokens
   frappe-ui does NOT define are kept in src/index.css. */

@theme inline {
  --color-*: initial;
${reg.join("\n")}
}

:root {
${emitPalette("lightMode")}

${emitNeutral()}

${emitOverlay()}

${emitSem("light")}
}

.dark {
${emitPalette("darkMode")}

${emitSem("dark")}
}
`

writeFileSync(OUT, out)
console.log(`Wrote ${OUT.pathname} — ${out.split("\n").length} lines, ${seen.size} tokens`)
