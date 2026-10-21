import { useEffect, useRef, useState } from "react"
import { useFormContext, type RegisterOptions } from "react-hook-form"
import { EditorContent } from "@tiptap/react"
import { FormDescription, FormField, FormItem, FormLabel, FormMessage, FormRequiredIndicator } from "@components/ui/form"
import { TooltipProvider } from "@components/ui/tooltip"
import { cn } from "@lib/utils"
import { EditorFormattingToolbar } from "./EditorFormattingToolbar"
import { useRavenEditor } from "./useRavenEditor"

/**
 * A controlled rich-text editor sized like a form input. Same editor and formatting
 * toolbar as the chat composer, in "document" mode: Enter makes a paragraph, no
 * mentions, nothing to submit. The value is the editor's HTML, "" when empty.
 */
export const RichTextEditor = ({
    value, onChange, placeholder, className,
}: { value: string; onChange: (html: string) => void; placeholder?: string; className?: string }) => {
    // ⌘⇧U opens the toolbar's link popover: linkRef bumps a signal the toolbar watches.
    const [linkSignal, setLinkSignal] = useState(0)
    const linkRef = useRef<() => void>(() => { })
    linkRef.current = () => setLinkSignal((n) => n + 1)

    const editor = useRavenEditor({ mode: "document", content: value, onUpdate: onChange, linkRef, placeholder })

    // The editor owns its state while the user types. Only a change from outside,
    // such as a form reset after save, is pushed back in.
    useEffect(() => {
        if (!editor || editor.isFocused) return
        const current = editor.isEmpty ? "" : editor.getHTML()
        if (value !== current) editor.commands.setContent(value || "", { emitUpdate: false })
    }, [editor, value])

    return (
        <div className={cn("w-full overflow-hidden rounded-md border border-outline-gray-2 bg-surface-base focus-within:border-outline-gray-3", className)}>
            <TooltipProvider>
                {editor && (
                    <EditorFormattingToolbar editor={editor} linkSignal={linkSignal} onLinkConsumed={() => setLinkSignal(0)} />
                )}
                <EditorContent editor={editor} />
            </TooltipProvider>
        </div>
    )
}

type Props = {
    name: string
    label: string
    rules?: Omit<RegisterOptions, "disabled" | "valueAsNumber" | "valueAsDate" | "setValueAs">
    isRequired?: boolean
    formDescription?: React.ReactNode
    placeholder?: string
    hideLabel?: boolean
}

/** RichTextEditor bound to a react-hook-form field. Stores HTML. */
export const RichTextFormField = ({ name, label, rules, isRequired, formDescription, placeholder, hideLabel }: Props) => {
    const { control } = useFormContext()
    return (
        <FormField
            control={control}
            name={name}
            rules={rules}
            render={({ field }) => (
                <FormItem className="min-w-0">
                    <FormLabel className={hideLabel ? "sr-only" : ""}>{label}{isRequired && <FormRequiredIndicator />}</FormLabel>
                    <RichTextEditor value={field.value ?? ""} onChange={field.onChange} placeholder={placeholder} />
                    {formDescription && <FormDescription>{formDescription}</FormDescription>}
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}

export default RichTextFormField
