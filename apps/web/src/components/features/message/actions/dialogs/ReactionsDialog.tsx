import { useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@components/ui/drawer"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@components/ui/tabs"
import { UserAvatar } from "@components/features/message/UserAvatar"
import { useUser } from "@hooks/useUser"
import { useIsMobile } from "@hooks/use-mobile"
import { parseReactions } from "../../renderers/MessageReactions"
import type { ReactionObject } from "@raven/types/common/ChatStream"
import type { Message } from "@raven/types/common/Message"
import type { UserData } from "@db"
import _ from "@lib/translate"
import { Badge } from "@components/ui/badge"

/** A custom emoji's readable name, shortcode-style. */
const customEmojiLabel = (reaction: ReactionObject) => `:${reaction.emoji_name}:`

/** Renders one reaction's glyph — a custom emoji image, or the Apple-set native emoji. */
const EmojiGlyph = ({ reaction }: { reaction: ReactionObject }) =>
    reaction.is_custom ? (
        <img src={reaction.reaction} alt={reaction.emoji_name} loading="lazy" className="h-4 w-4 object-contain" />
    ) : (
        <em-emoji native={reaction.reaction} set="native" size="1.1em" fallback={reaction.reaction} />
    )

/**
 * One reactor row: avatar + name, resolved reactively from the users store (so a profile /
 * photo update reflects live). `trailing` shows which emoji(s) they used in the "All" tab.
 * Falls back to the raw id while the user isn't cached.
 */
const ReactorRow = ({ userID, trailing }: { userID: string; trailing?: React.ReactNode }) => {
    const user = useUser(userID)
    const display = user ?? ({ name: userID, full_name: userID } as UserData)
    return (
        <div className="flex items-center gap-2 py-2 min-h-11">
            <UserAvatar user={display} size="sm" showStatusIndicator={false} />
            <span className="flex-1 truncate text-sm text-ink-gray-8">{display.full_name || display.name}</span>
            {trailing}
        </div>
    )
}

/** The tabbed who-reacted body — shared between the desktop dialog and mobile drawer. */
const ReactionsBody = ({ reactions }: { reactions: ReactionObject[] }) => {
    // userID → the reactions they used (for the "All" tab + its unique-reactor count).
    const reactorsByUser = useMemo(() => {
        const map = new Map<string, ReactionObject[]>()
        for (const reaction of reactions) {
            for (const userID of reaction.users) {
                const list = map.get(userID) ?? []
                list.push(reaction)
                map.set(userID, list)
            }
        }
        return map
    }, [reactions])

    if (reactions.length === 0) return null

    return (
        <Tabs defaultValue="all">
            <TabsList className="w-full">
                <TabsTrigger value="all" className="gap-2 w-full">
                    {_("All")} <span className="text-ink-gray-5 text-sm-regular">{reactorsByUser.size}</span>
                </TabsTrigger>
                {reactions.map((reaction) => (
                    <TabsTrigger key={reaction.emoji_name} value={reaction.emoji_name} className="gap-2 w-full">
                        <EmojiGlyph reaction={reaction} />
                        <span className="text-ink-gray-5 text-sm-regular">{reaction.count}</span>
                    </TabsTrigger>
                ))}
            </TabsList>

            {/* Mobile panels are pinned to one height (min-h-80 = max-h-80): the
                drawer hugs its content, so tabs with different row counts would
                resize the whole sheet on every switch. Pinned via MIN/MAX, not
                h-80 — the ui TabsContent's flex-1 (flex-basis: 0%) overrides a
                plain height as the flex main size, but min/max still clamp it.
                Desktop keeps the range — a dialog resizing in place is fine. */}
            <TabsContent value="all" className="max-h-80 min-h-80 overflow-y-auto px-4 md:px-6">
                {[...reactorsByUser].map(([userID, used]) => (
                    <ReactorRow
                        key={userID}
                        userID={userID}
                        trailing={
                            <span className="flex shrink-0 items-center gap-1">
                                {used.map((reaction) => (
                                    <EmojiGlyph key={reaction.emoji_name} reaction={reaction} />
                                ))}
                            </span>
                        }
                    />
                ))}
            </TabsContent>

            {reactions.map((reaction) => (
                <TabsContent key={reaction.emoji_name} value={reaction.emoji_name} className="max-h-80 min-h-80 overflow-y-auto px-4 md:px-6">
                    {/* A custom emoji's glyph doesn't say what it is — its panel opens
                        with the name. Native emojis need no caption. */}
                    {reaction.is_custom ? (
                        <Badge variant="subtle" size='lg'>
                            <img src={reaction.reaction} alt={reaction.emoji_name} loading="lazy" className="size-4 object-contain" />
                            {customEmojiLabel(reaction)}
                        </Badge>
                    ) : null}
                    {reaction.users.map((userID) => (
                        <ReactorRow key={userID} userID={userID} />
                    ))}
                </TabsContent>
            ))}
        </Tabs>
    )
}

/**
 * "View reactions" — who reacted, grouped by emoji. The reaction blob already carries the
 * reactor ids (no fetch); only the avatars/names are resolved from the users store. An
 * "All" tab lists each reactor once with the emoji(s) they used.
 *
 * Desktop: a dialog. Mobile: a bottom drawer (reached via long-press on a pill
 * or the action sheet — a centred modal reads wrong on a phone).
 */
export const ReactionsDialog = ({ message, open, onClose }: { message: Message | null; open: boolean; onClose: () => void }) => {
    const reactions = useMemo(() => parseReactions(message?.message_reactions), [message?.message_reactions])
    const isMobile = useIsMobile()

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
                <DrawerContent>
                    <DrawerTitle className="px-4 pb-4 pt-1 text-left text-2xl-semibold text-ink-gray-9">
                        {_("Reactions")}
                    </DrawerTitle>
<DrawerDescription className="sr-only">{_("Who reacted to this message")}</DrawerDescription>
                    <div className="pb-4">
                        <ReactionsBody reactions={reactions} />
                    </div>
                </DrawerContent>
            </Drawer>
        )
    }

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="px-0">
                <DialogHeader className="px-6">
                    <DialogTitle>{_("Reactions")}</DialogTitle>
                    <DialogDescription className="sr-only">{_("View who reacted to this message.")}</DialogDescription>
                </DialogHeader>
                <ReactionsBody reactions={reactions} />
            </DialogContent>
        </Dialog>
    )
}
