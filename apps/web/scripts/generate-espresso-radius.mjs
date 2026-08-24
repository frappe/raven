/**
 * Generates src/styles/espresso-radius.css from frappe-ui's canonical radius
 * definitions, so our Espresso radii stay identical to frappe-ui's.
 *
 *   Run: yarn gen:radius   (from apps/web)
 *
 * Source: frappe-ui/tailwind/generated/radius.json — a flat map of every
 * radius token: the numeric scale (0→9, where 9 = 999px for pills) plus the
 * named aliases (none / sm / DEFAULT / md / lg / xl / 2xl / full).
 *
 * Output is a single @theme block. We reset the namespace (--radius-*: initial)
 * so Tailwind's default radius scale is replaced wholesale by frappe-ui's, then
 * emit one var per token. DEFAULT becomes the bare `--radius` (Tailwind's
 * `rounded` utility) rather than an awkward `--radius-DEFAULT`. The one radius
 * frappe-ui does NOT define but raven uses — `xs` — is kept in src/index.css.
 */
import { writeFileSync } from "fs"

const SOURCE = "https://raw.githubusercontent.com/frappe/frappe-ui/main/tailwind/generated/radius.json"
const OUT = new URL("../src/styles/espresso-radius.css", import.meta.url)

const res = await fetch(SOURCE)
if (!res.ok) throw new Error(`Failed to fetch radius.json: ${res.status} ${res.statusText}`)
const radius = await res.json()

// DEFAULT → bare `--radius` (the `rounded` utility); everything else keeps its
// key. Source order is preserved (numeric scale, then aliases).
const lines = Object.entries(radius).map(([key, value]) =>
    key === "DEFAULT" ? `  --radius: ${value};` : `  --radius-${key}: ${value};`,
)

const out = `/* GENERATED from frappe-ui tailwind/generated/radius.json — do not hand-edit.
   Regenerate with: yarn gen:radius  (see scripts/generate-espresso-radius.mjs)

   frappe-ui's full radius scale (numeric 0-9 + named aliases). The namespace is
   reset so this replaces Tailwind's defaults entirely. App-specific radii
   frappe-ui does NOT define (e.g. xs) are kept in src/index.css. */

@theme {
  --radius-*: initial;
${lines.join("\n")}
}
`

writeFileSync(OUT, out)
console.log(`Wrote ${OUT.pathname} — ${lines.length} radius tokens`)
