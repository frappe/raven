import { useState } from "react"
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@components/ui/dialog"
import { Input } from "@components/ui/input"
import { Label } from "@components/ui/label"
import { Button } from "@components/ui/button"
import _ from "@lib/translate"

interface GroupNameDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    submitLabel: string
    initialName?: string
    /** Validate-and-commit; a failed result keeps the dialog open with the error inline. */
    onSubmit: (name: string) => { ok: true } | { ok: false; error: string }
}

/**
 * Shared name prompt for both group flows: create (channel table) and rename
 * (preview header). A dialog, not an inline editor swapped into the row — an
 * input inside a fixed-height row has no room for an error message, and
 * cancelling it needs hand-rolled Escape/blur handling that fights the
 * settings dialog's own Escape. The nested dialog gets all of that for free:
 * Escape closes the top layer only, and the error fits under the field.
 */
export const GroupNameDialog = ({ open, onOpenChange, title, submitLabel, initialName = "", onSubmit }: GroupNameDialogProps) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[420px]">
            {/* Gated on open so the form's state starts fresh every time. */}
            {open && (
                <GroupNameForm
                    title={title}
                    submitLabel={submitLabel}
                    initialName={initialName}
                    onSubmit={onSubmit}
                    close={() => onOpenChange(false)}
                />
            )}
        </DialogContent>
    </Dialog>
)

const GroupNameForm = ({
    title, submitLabel, initialName, onSubmit, close,
}: Omit<GroupNameDialogProps, "open" | "onOpenChange" | "initialName"> & { initialName: string; close: () => void }) => {
    const [name, setName] = useState(initialName)
    const [error, setError] = useState<string | undefined>(undefined)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const result = onSubmit(name)
        if (!result.ok) {
            setError(result.error)
            return
        }
        close()
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="channel-group-name">{_("Group name")}</Label>
                <Input
                    id="channel-group-name"
                    maxLength={50}
                    value={name}
                    aria-invalid={!!error}
                    onChange={(e) => {
                        setName(e.target.value)
                        setError(undefined)
                    }}
                />
                {error && <p className="text-ink-red-6 text-p-sm whitespace-pre-line">{error}</p>}
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button size="md" type="button" variant="outline">{_("Cancel")}</Button>
                </DialogClose>
                <Button size="md" type="submit" disabled={!name.trim()}>
                    {submitLabel}
                </Button>
            </DialogFooter>
        </form>
    )
}
