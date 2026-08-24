import { useRef, useState } from "react"
import { Plus, Camera, Images, FileBox, type LucideIcon, FilesIcon, ChartBar, Video } from "lucide-react"
import { Button } from "@components/ui/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from "@components/ui/drawer"
import { useAttachFile } from "./useFileInput"
import { CreatePollDialog } from "./CreatePollDialog"
import AttachFrappeDocumentDialog from "./AttachFrappeDocumentDialog"
import { isAndroid } from "@utils/platform"
import _ from "@lib/translate"

/**
 * Mobile composer overflow: a single "+" opens a bottom sheet of circle icon
 * tiles (camera / photos / files / document / poll — WhatsApp-style). The
 * poll/document dialogs are driven in controlled mode (they live OUTSIDE the
 * sheet, so closing it before opening them is safe); every attach path funnels
 * through the shared useAttachFile, so size/type validation still applies.
 *
 * The tiles are hidden file inputs whose ATTRIBUTES steer the OS picker:
 *   - camera:  `capture` opens the camera directly — but the two platforms
 *     disagree on the accept value. iOS: accept="image/*,video/*" + capture
 *     opens its camera with BOTH photo and video modes — one tile. Android:
 *     `capture` must resolve to a single camera intent (photo OR video), so a
 *     mixed accept makes Chrome silently DROP capture and open the photo
 *     picker instead — hence two tiles there (Camera / Video), each with a
 *     single-type accept. (One capture per trip; capture inputs don't support
 *     multiple.)
 *   - photos:  accept="image/*,video/*", no capture — straight to the library
 *   - files:   unrestricted. iOS insists on its camera/library/file chooser
 *     here — WebKit's accept handling is broken (rdar 36726477) and no accept
 *     value skips the sheet, so restricting types only costs Android's direct
 *     picker its media files. One extra tap on iOS is a platform limitation.
 */
export const MobileComposerActions = ({
    channelID,
}: {
    channelID: string
}) => {
    const [sheetOpen, setSheetOpen] = useState(false)
    const [pollOpen, setPollOpen] = useState(false)
    const [docOpen, setDocOpen] = useState(false)
    const onAddFile = useAttachFile(channelID)
    const cameraInputRef = useRef<HTMLInputElement>(null)
    const videoCaptureRef = useRef<HTMLInputElement>(null)
    const galleryInputRef = useRef<HTMLInputElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const onPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) onAddFile(e.target.files)
        e.target.value = ""
    }

    const tiles: { icon: LucideIcon; label: string; onSelect: () => void }[] = [
        { icon: Camera, label: _("Camera"), onSelect: () => cameraInputRef.current?.click() },
        // Android only: capture resolves to ONE camera intent, so photo and
        // video capture need separate tiles (see the file inputs below).
        ...(isAndroid ? [{ icon: Video, label: _("Video"), onSelect: () => videoCaptureRef.current?.click() }] : []),
        { icon: Images, label: _("Photos"), onSelect: () => galleryInputRef.current?.click() },
        { icon: FilesIcon, label: _("Files"), onSelect: () => fileInputRef.current?.click() },
        { icon: ChartBar, label: _("Poll"), onSelect: () => setPollOpen(true) },
        { icon: FileBox, label: _("Document"), onSelect: () => setDocOpen(true) },
    ]

    return (
        <>
            {isAndroid ? (
                <>
                    <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} className="hidden" onChange={onPicked} />
                    <input type="file" accept="video/*" capture="environment" ref={videoCaptureRef} className="hidden" onChange={onPicked} />
                </>
            ) : (
                <input type="file" accept="image/*,video/*" capture="environment" ref={cameraInputRef} className="hidden" onChange={onPicked} />
            )}
            <input type="file" accept="image/*,video/*" multiple ref={galleryInputRef} className="hidden" onChange={onPicked} />
            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={onPicked} />

            <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
                <DrawerTrigger asChild>
                    <Button type="button" variant="ghost" size="lg" isIconButton aria-label={_("More actions")} className="rounded-full">
                        <Plus className="size-8" />
                    </Button>
                </DrawerTrigger>
                <DrawerContent>
                    <DrawerTitle className="sr-only">{_("Composer actions")}</DrawerTitle>
                    <DrawerDescription className="sr-only">{_("Attach files, polls and more")}</DrawerDescription>
                    {/* Circle icon tiles, WhatsApp-style — every option is an icon */}
                    <div className="grid grid-cols-4 gap-x-2 gap-y-6 px-4 pt-6 pb-10">
                        {tiles.map((tile) => (
                            <button
                                key={tile.label}
                                type="button"
                                className="flex flex-col items-center gap-2"
                                onClick={() => {
                                    setSheetOpen(false)
                                    tile.onSelect()
                                }}
                            >
                                <span className="flex size-14 items-center justify-center rounded-full bg-surface-gray-2 transition-colors active:bg-surface-gray-4 dark:bg-surface-elevation-3 dark:active:bg-surface-gray-4">
                                    <tile.icon className="size-6 text-ink-gray-7" />
                                </span>
                                <span className="text-xs text-ink-gray-6">{tile.label}</span>
                            </button>
                        ))}
                    </div>
                </DrawerContent>
            </Drawer>

            {/* Controlled dialogs opened from the sheet rows (triggers hidden). */}
            <CreatePollDialog channelID={channelID} open={pollOpen} onOpenChange={setPollOpen} hideTrigger />
            <AttachFrappeDocumentDialog channelID={channelID} open={docOpen} onOpenChange={setDocOpen} hideTrigger />
        </>
    )
}
