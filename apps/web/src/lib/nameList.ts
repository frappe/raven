import _ from "@lib/translate"

/**
 * Human-readable list of names, translatable: whole-list templates so the
 * conjunction and word order stay in the translator's hands (word order and
 * "and" vary across languages). Spells up to three names, then compresses to
 * two names + "N others".
 *
 * `total` is the real count; pass it when `names` was truncated upstream —
 * only the first two names are used once total exceeds three.
 */
export const formatNameList = (names: string[], total: number = names.length): string => {
    if (total === 1) return names[0]
    if (total === 2) return _("{0} and {1}", [names[0], names[1]])
    if (total === 3) return _("{0}, {1} and {2}", [names[0], names[1], names[2]])
    return _("{0}, {1} and {2} others", [names[0], names[1], String(total - 2)])
}
