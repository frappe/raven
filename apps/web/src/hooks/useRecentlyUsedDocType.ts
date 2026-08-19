import { useCallback, useMemo } from "react"
import { useLocalStorage } from "usehooks-ts"
import _ from "@lib/translate"
import type { ResultItem } from "@components/common/LinkFieldComboBox/LinkFieldCombobox"

const STORAGE_KEY = "recently-used-doctype"
const MAX_RECENT = 5

/**
 * Move `item` to the front of `list`, de-duplicated and capped. Re-picking an
 * entry that is already present bumps it — v2's version skipped the write
 * entirely in that case, so its "recent" order never reflected actual recency.
 */
export const toMostRecent = (list: string[], item: string, limit: number = MAX_RECENT): string[] =>
	[item, ...list.filter((entry) => entry !== item)].slice(0, limit)

/**
 * The doctypes this user picked most recently, shaped for `LinkFieldCombobox`'s
 * `suggestedItems`. Persisted in localStorage (v2 used sessionStorage, which lost
 * the list on every tab close).
 */
export const useRecentlyUsedDocType = () => {
	const [recent, setRecent] = useLocalStorage<string[]>(STORAGE_KEY, [])

	const addRecentlyUsedDocType = useCallback(
		(doctype: string) => setRecent((previous) => toMostRecent(previous, doctype)),
		[setRecent],
	)

	const suggestedItems = useMemo<ResultItem[]>(
		() => recent.map((value) => ({ value, description: _("Recently used") })),
		[recent],
	)

	return { suggestedItems, addRecentlyUsedDocType }
}
