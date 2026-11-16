import { useState } from "react"
import { FrappeError, useFrappeGetCall, useFrappeUpdateDoc } from "frappe-react-sdk"
import { CheckIcon, Search, SearchX } from "lucide-react"
import { FILTER_ITEM_STYLES } from "@components/common/filters/FilterCombobox"
import { Button } from "@components/ui/button"
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@components/ui/dialog"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"
import ErrorBanner from "@components/ui/error-banner"
import { Input } from "@components/ui/input"
import { SettingsFormDescription, SettingsFormLabel, SettingsFormRow } from "@components/ui/settings-dialog"
import { InputGroup, InputGroupAddon } from "@components/ui/input-group"
import { translatedLanguages } from "@lib/locale"
import { sessionUser } from "@lib/sessionUser"
import _ from "@lib/translate"
import { cn } from "@lib/utils"

type Language = { code: string; name: string; localName?: string }

/** The language the app is showing now. The boot resolves it from the user, then the site. */
const currentLanguage = (): string => (window.frappe?.boot?.lang as string | undefined) || "en"

/** A language's name in the language the app is showing now, like "Arabic" for ar in English. */
const nameInCurrentLanguage = (code: string): string | undefined => {
    try {
        return new Intl.DisplayNames([currentLanguage()], { type: "language" }).of(code)
    } catch {
        // A code the browser does not know.
        return undefined
    }
}

/**
 * The languages the site has turned on, each in its own name ("العربية" for ar).
 * Raven's translated languages come first, in Raven's order. The rest follow by name.
 */
const useLanguages = (): { translated: Language[]; others: Language[] } => {
    const { data } = useFrappeGetCall<{ message: { language_code: string; language_name: string }[] }>(
        "frappe.translate.get_all_languages",
        { with_language_name: 1 },
        undefined,
        { revalidateOnFocus: false },
    )
    const languages = (data?.message ?? []).map((language) => ({
        code: language.language_code,
        name: language.language_name,
        localName: nameInCurrentLanguage(language.language_code),
    }))
    const translatedCodes = translatedLanguages()
    return {
        translated: translatedCodes.flatMap((code) => languages.filter((language) => language.code === code)),
        others: languages
            .filter((language) => !translatedCodes.includes(language.code))
            .sort((a, b) => a.name.localeCompare(b.name)),
    }
}

const matches = (language: Language, search: string): boolean =>
    [language.name, language.localName ?? "", language.code].some((text) => text.toLowerCase().includes(search))

/** The Language row in Appearance: the current language and a button to change it. */
export const LanguageSetting = () => {
    const [open, setOpen] = useState(false)
    const { translated, others } = useLanguages()
    const code = currentLanguage()
    const current = [...translated, ...others].find((language) => language.code === code)

    return (
        <>
            <SettingsFormRow>
                <div className="flex flex-col">
                    <SettingsFormLabel>{_("Language")}</SettingsFormLabel>
                    <SettingsFormDescription>{current?.name ?? code}</SettingsFormDescription>
                </div>
                <Button variant="subtle" size="md" onClick={() => setOpen(true)}>
                    {_("Change language")}
                </Button>
            </SettingsFormRow>
            {open && <ChangeLanguageDialog translated={translated} others={others} onClose={() => setOpen(false)} />}
        </>
    )
}

/**
 * Saves the language on the Frappe user, so the desk follows it too. The boot carries the
 * translations and the direction, so the page reloads to pick them up.
 */
const ChangeLanguageDialog = ({ translated, others, onClose }: {
    translated: Language[]
    others: Language[]
    onClose: () => void
}) => {
    const [selected, setSelected] = useState(currentLanguage())
    const [search, setSearch] = useState("")
    const { updateDoc, loading, error } = useFrappeUpdateDoc()

    const changeLanguage = () => {
        updateDoc("User", sessionUser().name, { language: selected })
            .then(() => window.location.reload())
            .catch(() => {
                // The banner shows the error and the dialog stays open to retry.
            })
    }

    const query = search.trim().toLowerCase()
    const shownTranslated = translated.filter((language) => matches(language, query))
    const shownOthers = others.filter((language) => matches(language, query))
    // Named once a different language is picked, like "Change language to Arabic".
    const selectedLanguage = selected === currentLanguage()
        ? undefined
        : [...translated, ...others].find((language) => language.code === selected)
    const renderRow = (language: Language) => (
        <LanguageRow key={language.code} language={language} selected={language.code === selected} onSelect={setSelected} />
    )

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[85vh]">
                <DialogHeader>
                    <DialogTitle>{_("Change language")}</DialogTitle>
                    <DialogDescription>{_("Raven will reload to show the new language.")}</DialogDescription>
                </DialogHeader>
                {/* Fixed height: filtering while typing must not resize the dialog. */}
                <DialogBody className="flex h-[24rem] flex-none flex-col gap-3">
                    {error ? <ErrorBanner error={error as FrappeError} /> : null}
                    <InputGroup size="md" variant="outline" className="shrink-0">
                        <InputGroupAddon><Search /></InputGroupAddon>
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={_("Search")}
                            aria-label={_("Search")}
                            inputSize="md"
                            type="text"
                        />
                    </InputGroup>
                    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
                        {shownTranslated.map(renderRow)}
                        {/* The line between the two parts. A search shows one list. */}
                        {!query && shownOthers.length > 0 && <div className="my-1 h-px shrink-0 bg-outline-gray-1" />}
                        {shownOthers.map(renderRow)}
                        {shownTranslated.length === 0 && shownOthers.length === 0 && (
                            <div className="flex h-full items-center justify-center">
                                <Empty>
                                    <EmptyMedia><SearchX /></EmptyMedia>
                                    <EmptyHeader>
                                        <EmptyTitle>{_("No matches")}</EmptyTitle>
                                    </EmptyHeader>
                                </Empty>
                            </div>
                        )}
                    </div>
                </DialogBody>
                <DialogFooter>
                    <Button type="button" variant="outline" size="md" onClick={onClose} disabled={loading}>
                        {_("Cancel")}
                    </Button>
                    <Button
                        type="button"
                        size="md"
                        onClick={changeLanguage}
                        disabled={selected === currentLanguage()}
                        loading={loading}
                        loadingText={_("Saving...")}
                    >
                        {selectedLanguage ? _("Change language to {0}", [selectedLanguage.localName ?? selectedLanguage.name]) : _("Change language")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

/** One language: its own name, then its name in the current language. Same row as the search filters. */
const LanguageRow = ({ language, selected, onSelect }: {
    language: Language
    selected: boolean
    onSelect: (code: string) => void
}) => (
    <button
        type="button"
        onClick={() => onSelect(language.code)}
        aria-pressed={selected}
        className={cn(
            FILTER_ITEM_STYLES,
            "w-full shrink-0 justify-between text-start",
            selected && "bg-surface-gray-2 hover:bg-surface-gray-3",
        )}
    >
        <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate">{language.name}</span>
            {language.localName && language.localName !== language.name && (
                <span className="truncate text-sm text-ink-gray-5">{language.localName}</span>
            )}
        </span>
        {selected && <CheckIcon className="size-4 shrink-0 text-ink-gray-6" />}
    </button>
)
