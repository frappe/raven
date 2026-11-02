import { useMemo, useState } from "react"
import { Search, SearchX } from "lucide-react"
import { Virtuoso } from "react-virtuoso"
import { useDebounceValue } from "usehooks-ts"
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar"
import { Button } from "@components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@components/ui/dialog"
import { Drawer, DrawerActionBar, DrawerClose, DrawerContent, DrawerDescription, DrawerTrigger } from "@components/ui/drawer"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@components/ui/empty"
import { Input } from "@components/ui/input"
import { InputGroup, InputGroupAddon } from "@components/ui/input-group"
import { useIsMobile } from "@hooks/use-mobile"
import { siteUrl } from "@lib/site"
import _ from "@lib/translate"
import { cn } from "@lib/utils"
import type { SiteUser } from "../types"

type SiteUsersDialogProps = {
    users: SiteUser[]
    selected: Set<string>
    onSelectedChange: (selected: Set<string>) => void
    trigger: React.ReactNode
}

/**
 * Picks who on the site joins the workspace: the channel members picker's one toggle list,
 * with a search and Select all, since a site can have hundreds of people. The choice is kept
 * until Done, so Cancel leaves the step as it was.
 */
export const SiteUsersDialog = ({ users, selected, onSelectedChange, trigger }: SiteUsersDialogProps) => {
    const isMobile = useIsMobile()
    const [open, setOpen] = useState(false)
    const [draft, setDraft] = useState(selected)

    const onOpenChange = (next: boolean) => {
        if (next) setDraft(selected)
        setOpen(next)
    }
    const done = () => {
        onSelectedChange(draft)
        setOpen(false)
    }

    const body = <SiteUsersList users={users} selected={draft} onSelectedChange={setDraft} />
    const title = _("Add people from this site")
    const description = _("Everyone on this site who isn't in a workspace yet.")

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerTrigger asChild>{trigger}</DrawerTrigger>
                <DrawerContent className="h-[85dvh]">
                    {/* Actions in a top bar: the search keyboard would cover a footer. */}
                    <DrawerActionBar
                        title={title}
                        leading={
                            <DrawerClose asChild>
                                <Button variant="ghost" size="md">{_("Cancel")}</Button>
                            </DrawerClose>
                        }
                        trailing={<Button variant="ghost" size="md" onClick={done}>{_("Done")}</Button>}
                    />
                    <DrawerDescription className="sr-only">{description}</DrawerDescription>
                    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-2">{body}</div>
                </DrawerContent>
            </Drawer>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-h-[85vh]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="sr-only">{description}</DialogDescription>
                </DialogHeader>
                {/* A fixed list height, so filtering while typing doesn't resize the dialog. */}
                <DialogBody className="flex h-[24rem] flex-none flex-col gap-3">{body}</DialogBody>
                <DialogFooter>
                    <Button type="button" variant="outline" size="md" onClick={() => onOpenChange(false)}>
                        {_("Cancel")}
                    </Button>
                    <Button type="button" size="md" onClick={done}>
                        {draft.size === 0 ? _("Done") : draft.size === 1 ? _("Add 1 person") : _("Add {0} people", [String(draft.size)])}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

const SiteUsersList = ({ users, selected, onSelectedChange }: { users: SiteUser[]; selected: Set<string>; onSelectedChange: (selected: Set<string>) => void }) => {
    // The input is uncontrolled; only the filter lags the typing.
    const [filterText, setFilterText] = useDebounceValue("", 200)
    const shown = useMemo(() => {
        const wanted = filterText.trim().toLowerCase()
        if (!wanted) return users
        return users.filter((user) => user.full_name.toLowerCase().includes(wanted) || user.user.toLowerCase().includes(wanted))
    }, [users, filterText])
    const addable = shown.filter((user) => user.addable !== false)
    const allShownSelected = addable.length > 0 && addable.every((user) => selected.has(user.user))

    const toggle = (user: SiteUser) => {
        if (user.addable === false) return
        const next = new Set(selected)
        if (next.has(user.user)) next.delete(user.user)
        else next.add(user.user)
        onSelectedChange(next)
    }
    // Select all works on the shown rows, so a search narrows what it picks.
    const selectShown = (on: boolean) => {
        const next = new Set(selected)
        for (const user of addable) on ? next.add(user.user) : next.delete(user.user)
        onSelectedChange(next)
    }

    return (
        <div className="flex h-full min-h-0 flex-col gap-3">
            <InputGroup size="md" variant="outline">
                <InputGroupAddon><Search /></InputGroupAddon>
                <Input
                    placeholder={_("Search by name or email...")}
                    onChange={(event) => setFilterText(event.target.value)}
                    // Enter while searching must not submit the step's form behind the dialog.
                    onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault() }}
                    inputSize="md"
                    type="text"
                    aria-label={_("Search people")}
                />
            </InputGroup>
            <div className="flex h-7 shrink-0 items-center justify-between">
                <span className="text-sm text-ink-gray-5">
                    {selected.size === 0 ? _("No one selected") : selected.size === 1 ? _("1 person selected") : _("{0} people selected", [String(selected.size)])}
                </span>
                {addable.length > 0 && (
                    <Button type="button" variant="ghost" size="xs" onClick={() => selectShown(!allShownSelected)}>
                        {allShownSelected ? _("Clear all") : _("Select all")}
                    </Button>
                )}
            </div>
            <div className="min-h-0 flex-1">
                {shown.length === 0 ? (
                    <Empty className="min-h-0 h-full">
                        <EmptyMedia><SearchX /></EmptyMedia>
                        <EmptyHeader>
                            <EmptyTitle>{_("No one found")}</EmptyTitle>
                            <EmptyDescription>{_("Try another name or email.")}</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <Virtuoso
                        style={{ height: "100%", width: "100%" }}
                        data={shown}
                        overscan={200}
                        itemContent={(_index, user) => <SiteUserRow user={user} selected={selected.has(user.user)} onToggle={() => toggle(user)} />}
                    />
                )}
            </div>
        </div>
    )
}

/** One toggle row, as the channel members picker draws it. A row that can't be added says why. */
const SiteUserRow = ({ user, selected, onToggle }: { user: SiteUser; selected: boolean; onToggle: () => void }) => {
    const disabled = user.addable === false
    return (
        <div className="pb-0.5">
            <button
                type="button"
                onClick={onToggle}
                aria-pressed={selected}
                disabled={disabled}
                className={cn(
                    "flex w-full items-center gap-2.5 rounded py-1.5 ps-1.5 pe-3 text-start transition-colors",
                    disabled ? "cursor-default opacity-60" : "cursor-pointer hover:bg-surface-gray-2",
                    selected && "bg-surface-gray-1",
                )}
            >
                <Avatar className="size-7 shrink-0 rounded-md">
                    <AvatarImage src={user.user_image ? siteUrl(user.user_image) : undefined} alt={user.full_name} />
                    <AvatarFallback>{(user.full_name || user.user).charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium leading-tight">{user.full_name || user.user}</div>
                    <div className="truncate text-xs leading-tight text-ink-gray-4">
                        {/* Not addable: a Raven Admin can't give access (that saves the User), or, on Frappe 15,
                            the person's one role profile can't take Raven's. */}
                        {!disabled ? user.user : user.role_profile ? _("Add the Raven User role to the {0} profile first", [user.role_profile]) : _("A System Manager can add them")}
                    </div>
                </div>
                {/* Visual state only; the row is the control. Mirrors ui/checkbox's checked look. */}
                <span
                    aria-hidden="true"
                    className={cn(
                        "grid size-4 shrink-0 place-content-center rounded-sm border transition",
                        selected ? "border-ink-gray-8 bg-ink-gray-8 text-ink-base" : "border-outline-gray-3 bg-surface-base",
                    )}
                >
                    {selected && <svg viewBox="0 0 16 16" className="size-3 fill-none stroke-current stroke-2"><path d="M3.5 8.5l3 3 6-6" /></svg>}
                </span>
            </button>
        </div>
    )
}
