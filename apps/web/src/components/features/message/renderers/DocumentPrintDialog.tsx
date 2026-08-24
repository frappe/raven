import { useEffect, useMemo, useRef, useState } from "react"
import { DownloadIcon, PrinterIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@components/ui/dialog"
import { Label } from "@components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import LinkFieldCombobox from "@components/common/LinkFieldComboBox/LinkFieldCombobox"
import type { DoctypeMeta } from "@hooks/useDoctypeMeta"
import _ from "@lib/translate"

const STANDARD_FORMAT = "Standard"

/**
 * Print a linked document from chat: live preview (the desk /printview page in
 * an iframe) with print format, letterhead, and language pickers — defaults
 * pre-set (meta's default format, the site's default letterhead, the user's
 * language). Changing a picker just swaps the iframe URL.
 */
export const DocumentPrintDialog = ({
    doctype,
    docname,
    meta,
    open,
    onOpenChange,
}: {
    doctype: string
    docname: string
    meta?: DoctypeMeta
    open: boolean
    onOpenChange: (open: boolean) => void
}) => {
    const formats = useMemo(() => {
        const names = (meta?.__print_formats ?? []).map((format) => format.name)
        return names.includes(STANDARD_FORMAT) ? names : [...names, STANDARD_FORMAT]
    }, [meta])

    const [format, setFormat] = useState(meta?.default_print_format || STANDARD_FORMAT)
    // The user's own pick always wins over a late-arriving meta default.
    const formatTouchedRef = useRef(false)
    // Meta can still be loading when the dialog opens (its fetch is independent
    // of the card's preview data). Adopt the doctype's default format when it
    // lands — a useState initializer alone would stick on "Standard" forever.
    useEffect(() => {
        if (formatTouchedRef.current) return
        if (meta?.default_print_format) setFormat(meta.default_print_format)
    }, [meta?.default_print_format])

    // Empty = let the server pick the site's default letterhead.
    const [letterhead, setLetterhead] = useState("")
    const [language, setLanguage] = useState((window.frappe?.boot?.lang as string | undefined) || "en")

    // The printview PAGE reads the language as `_lang`; the download_pdf API
    // takes it as `language` (unknown kwargs are silently dropped, so sending
    // _lang there would quietly produce a PDF in the wrong language).
    const buildParams = (langParam: "_lang" | "language", extra?: Record<string, string>) => {
        const params = new URLSearchParams({
            doctype,
            name: docname,
            format,
            [langParam]: language,
            ...extra,
        })
        if (letterhead) params.set("letterhead", letterhead)
        return params.toString()
    }

    const previewUrl = `/printview?${buildParams("_lang", { trigger_print: "0" })}`

    const onPrint = () => window.open(`/printview?${buildParams("_lang", { trigger_print: "1" })}`, "_blank")
    const onDownloadPdf = () =>
        window.open(`/api/method/frappe.utils.print_format.download_pdf?${buildParams("language")}`, "_blank")

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[85dvh] flex-col gap-3 sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{_("Print {0}", [docname])}</DialogTitle>
                    <DialogDescription>{doctype}</DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex min-w-40 flex-col gap-1">
                        <Label htmlFor="print-format">{_("Print format")}</Label>
                        <Select
                            value={format}
                            onValueChange={(value) => {
                                formatTouchedRef.current = true
                                setFormat(value)
                            }}
                        >
                            <SelectTrigger id="print-format" className="min-w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {formats.map((name) => (
                                    <SelectItem key={name} value={name}>
                                        {name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex min-w-40 flex-col gap-1">
                        <Label>{_("Letterhead")}</Label>
                        <LinkFieldCombobox
                            doctype="Letter Head"
                            value={letterhead}
                            onChange={setLetterhead}
                            placeholder={_("Default")}
                        />
                    </div>
                    <div className="flex min-w-40 flex-col gap-1">
                        <Label>{_("Language")}</Label>
                        <LinkFieldCombobox doctype="Language" value={language} onChange={setLanguage} />
                    </div>
                </div>

                {/* key: a picker change swaps the URL and remounts the iframe — simpler
                    and more reliable than reaching into a cross-document navigation. */}
                <iframe
                    key={previewUrl}
                    src={previewUrl}
                    title={_("Print preview")}
                    className="w-full flex-1 rounded-md border border-outline-gray-2 bg-white"
                />

                <DialogFooter>
                    <Button variant="outline" onClick={onDownloadPdf}>
                        <DownloadIcon />
                        {_("Download PDF")}
                    </Button>
                    <Button onClick={onPrint}>
                        <PrinterIcon />
                        {_("Print")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
