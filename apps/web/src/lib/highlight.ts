import hljs from "highlight.js/lib/core"
import bash from "highlight.js/lib/languages/bash"
import c from "highlight.js/lib/languages/c"
import cpp from "highlight.js/lib/languages/cpp"
import csharp from "highlight.js/lib/languages/csharp"
import css from "highlight.js/lib/languages/css"
import dockerfile from "highlight.js/lib/languages/dockerfile"
import go from "highlight.js/lib/languages/go"
import ini from "highlight.js/lib/languages/ini"
import java from "highlight.js/lib/languages/java"
import javascript from "highlight.js/lib/languages/javascript"
import json from "highlight.js/lib/languages/json"
import kotlin from "highlight.js/lib/languages/kotlin"
import markdown from "highlight.js/lib/languages/markdown"
import php from "highlight.js/lib/languages/php"
import python from "highlight.js/lib/languages/python"
import ruby from "highlight.js/lib/languages/ruby"
import rust from "highlight.js/lib/languages/rust"
import scss from "highlight.js/lib/languages/scss"
import shell from "highlight.js/lib/languages/shell"
import sql from "highlight.js/lib/languages/sql"
import typescript from "highlight.js/lib/languages/typescript"
import xml from "highlight.js/lib/languages/xml"
import yaml from "highlight.js/lib/languages/yaml"

/**
 * Curated highlight.js bundle for message code blocks. Lives in its own module
 * so callers can `import("@lib/highlight")` lazily — keeping highlight.js (and
 * these language grammars) out of the main chat bundle until a code block is
 * actually rendered. Registering a language also registers its aliases, so
 * `js`/`ts`/`py`/`sh`/`yml`/`html` resolve for free.
 */
const LANGUAGES = {
    bash, c, cpp, csharp, css, dockerfile, go, ini, java, javascript, json, kotlin,
    markdown, php, python, ruby, rust, scss, shell, sql, typescript, xml, yaml,
}

for (const [name, language] of Object.entries(LANGUAGES)) {
    hljs.registerLanguage(name, language)
}

/**
 * Highlight `code` to an HTML string of `<span class="hljs-…">` tokens. Uses
 * the given language when known, otherwise auto-detects among the registered
 * set (v2 stored most code blocks without a `language-*` class, so this is the
 * common path). highlight.js escapes its input, so the result is safe to inject.
 *
 * Returns the resolved language too — the auto-detected one when none was given,
 * so the UI can label an otherwise-unlabelled block.
 */
export function highlightCode(code: string, language?: string): { value: string; language?: string } {
    const lang = language?.toLowerCase()
    if (lang && hljs.getLanguage(lang)) {
        return { value: hljs.highlight(code, { language: lang, ignoreIllegals: true }).value, language: lang }
    }
    const auto = hljs.highlightAuto(code)
    return { value: auto.value, language: auto.language }
}
