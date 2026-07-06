import { Message } from "../../../../../../types/Messaging/Message"
import { useCallback, useMemo, useRef, useState } from "react"
import { ArchivedChannelBox } from "../chat-footer/ArchivedChannelBox"
import { ChannelListItem, DMChannelListItem } from "@/utils/channel/ChannelListProvider"
import { JoinChannelBox } from "../chat-footer/JoinChannelBox"
import { useUserData } from "@/hooks/useUserData"
import useFileUpload from "../ChatInput/FileInput/useFileUpload"
import { CustomFile, FileDrop } from "../../file-upload/FileDrop"
import { FileListItem } from "../../file-upload/FileListItem"
import { useSendMessage } from "../ChatInput/useSendMessage"
import { Flex, Box, IconButton, Checkbox, Text } from "@radix-ui/themes"
import { ReplyMessageBox } from "../ChatMessage/ReplyMessageBox/ReplyMessageBox"
import { BiX } from "react-icons/bi"
import ChatStream from "./ChatStream"
import Tiptap from "../ChatInput/Tiptap"
import useFetchChannelMembers, { Member } from "@/hooks/fetchers/useFetchChannelMembers"
import { useParams } from "react-router-dom"
import clsx from "clsx"
import { HStack, Stack } from "@/components/layout/Stack"
import TypingIndicator from "../ChatInput/TypingIndicator/TypingIndicator"
import { useTyping } from "../ChatInput/TypingIndicator/useTypingIndicator"
import { Label } from "@/components/common/Form"
import { RavenMessage } from "@/types/RavenMessaging/RavenMessage"
import { useSWRConfig } from "frappe-react-sdk"
import { GetMessagesResponse } from "./useChatStream"
import { useIsMobile } from "@/hooks/useMediaQuery"
import { getFileType } from "@/utils/layout/FileExtIcon"
import { getFileExtension } from "@/utils/operations"
import { useIsSiteInReadOnlyMode } from "@/hooks/useIsSiteInReadOnlyMode"

const COOL_PLACEHOLDERS = [
    "Delivering messages atop dragons 🐉 is available on a chargeable basis.",
    "Note 🚨: Service beyond the wall is currently disrupted due to bad weather.",
    "Pigeons just have better brand recognition tbh 🤷🏻",
    "Ravens double up as spies. Eyes everywhere 👀",
    "Ravens do not 'slack' off. See what we did there? 😉",
    "Were you expecting a funny placeholder? 😂",
    "Want to know who writes these placeholders? 🤔. No one.",
    "Type a message..."
]
// const randomPlaceholder = COOL_PLACEHOLDERS[Math.floor(Math.random() * (COOL_PLACEHOLDERS.length))]
interface ChatBoxBodyProps {
    channelData: ChannelListItem | DMChannelListItem
}

export const ChatBoxBody = ({ channelData }: ChatBoxBodyProps) => {

    const { name: user } = useUserData()
    const { channelMembers, isLoading } = useFetchChannelMembers(channelData.name)

    const { onUserType, stopTyping } = useTyping(channelData.name)

    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)

    const handleReplyAction = (message: Message) => {
        setSelectedMessage(message)
    }

    const clearSelectedMessage = () => {
        setSelectedMessage(null)
    }

    const { mutate } = useSWRConfig()

    const scrollRef = useRef<HTMLDivElement>(null)

    const onMessageSendCompleted = (messages: RavenMessage[]) => {
        // Update the messages in the cache

        mutate({ path: `get_messages_for_channel_${channelData.name}` }, (data?: GetMessagesResponse) => {
            if (data && data?.message.has_new_messages) {
                return data
            }

            const existingMessages = data?.message.messages ?? []

            const newMessages = [...existingMessages]

            messages.forEach(message => {
                // Check if the message is already present in the messages array
                const messageIndex = existingMessages.findIndex(m => m.name === message.name)

                if (messageIndex !== -1) {
                    // If the message is already present, update the message
                    // @ts-ignore
                    newMessages[messageIndex] = {
                        ...message,
                        _liked_by: "",
                        is_pinned: 0,
                        is_continuation: 0
                    }
                } else {
                    // If the message is not present, add the message to the array
                    // @ts-ignore
                    newMessages.push({
                        ...message,
                        _liked_by: "",
                        is_pinned: 0,
                        is_continuation: 0
                    })
                }
            })

            return {
                message: {
                    messages: newMessages.sort((a, b) => {
                        return new Date(b.creation).getTime() - new Date(a.creation).getTime()
                    }),
                    has_new_messages: false,
                    has_old_messages: data?.message.has_old_messages ?? false
                }
            }

        }, { revalidate: false }).then(() => {
            // If the user is focused on the page, then we also need to
            // If the user is the sender of the message, scroll to the bottom
            scrollRef.current?.scrollTo(0, scrollRef.current?.scrollHeight)
        })

        // Stop the typing indicator
        stopTyping()
        // Clear the selected message
        clearSelectedMessage()
    }

    const channelMemberProfile: Member | null = useMemo(() => {
        if (user && channelMembers) {
            return channelMembers[user] ?? null
        }
        return null
    }, [user, channelMembers])

    const chatStreamRef = useRef<any>(null)

    const onUpArrowPressed = useCallback(() => {
        // Call the up arrow function inside the ChatStream component
        chatStreamRef.current?.onUpArrow()
    }, [])

    const tiptapRef = useRef<any>(null)

    const isMobile = useIsMobile()

    // When the edit modal is closed, we need to focus the editor again
    // Don't do this on mobile since that would open the keyboard
    const onModalClose = useCallback(() => {
        if (!isMobile) {
            setTimeout(() => {
                tiptapRef.current?.focusEditor()
            }, 50)
        }
    }, [isMobile])

    const { fileInputRef, files, setFiles, removeFile, uploadFiles, addFile, fileUploadProgress, compressImages, setCompressImages } = useFileUpload(channelData.name)

    const { sendMessage, loading } = useSendMessage(channelData.name, uploadFiles, onMessageSendCompleted, selectedMessage)

    const PreviousMessagePreview = ({ selectedMessage }: { selectedMessage: any }) => {

        if (selectedMessage) {
            return <ReplyMessageBox
                justify='between'
                align='center'
                className="m-2"
                message={selectedMessage}>
                <IconButton
                    color='gray'
                    size='1'
                    variant="soft"
                    onClick={clearSelectedMessage}>
                    <BiX size='20' />
                </IconButton>
            </ReplyMessageBox>
        }
        return null
    }

    const { canUserSendMessage, shouldShowJoinBox } = useMemo(() => {

        if (channelData.is_archived) {
            return {
                canUserSendMessage: false,
                shouldShowJoinBox: false
            }
        }


        if (channelData.type === 'Open') {
            return {
                canUserSendMessage: true,
                shouldShowJoinBox: false
            }
        }

        if (channelMemberProfile) {
            return {
                canUserSendMessage: true,
                shouldShowJoinBox: false
            }
        }

        const isDM = channelData?.is_direct_message === 1 || channelData?.is_self_message === 1

        // If the channel data is loaded and the member profile is loaded, then check for this, else don't show anything.
        if (!channelMemberProfile && !isDM && channelData && !isLoading) {
            return {
                shouldShowJoinBox: true,
                canUserSendMessage: false
            }
        }

        return { canUserSendMessage: false, shouldShowJoinBox: false }

    }, [channelMemberProfile, channelData, isLoading])


    const { threadID } = useParams()

    const isImageFile = useCallback((file: CustomFile) => {
        return getFileType(getFileExtension(file.name)) === 'image'
    }, [files])

    const isSiteInReadOnlyMode = useIsSiteInReadOnlyMode()

    return (
        <ChatBoxBodyContainer>
            <FileDrop
                files={files}
                ref={fileInputRef}
                onFileChange={setFiles}
                width={threadID ? 'w-[calc((100vw-var(--sidebar-width)-var(--space-8))/2)]' : undefined}
                maxFiles={10}
                maxFileSize={10000000}>
                <ChatStream
                    channelID={channelData.name}
                    scrollRef={scrollRef}
                    ref={chatStreamRef}
                    onModalClose={onModalClose}
                    pinnedMessagesString={channelData.pinned_messages_string}
                    replyToMessage={handleReplyAction}
                    isChannelReadOnly={!channelMemberProfile}
                />
                {canUserSendMessage &&
                    <Stack>
                        <TypingIndicator channel={channelData.name} />
                        {isSiteInReadOnlyMode ? <Box p='3' className="border border-gray-6 rounded-md bg-slate-1 animate-fadein text-center">
                            <Text as='span' size='2' weight='regular' color='gray'>
                                The site is in read-only mode. Please wait while the site is being updated.
                            </Text>
                        </Box> :
                            <Tiptap
                                key={channelData.name}
                                channelID={channelData.name}
                                fileProps={{
                                    fileInputRef,
                                    addFile
                                }}
                                ref={tiptapRef}
                                onUpArrow={onUpArrowPressed}
                                clearReplyMessage={clearSelectedMessage}
                                channelMembers={channelMembers}
                                onUserType={onUserType}
                                // placeholder={randomPlaceholder}
                                replyMessage={selectedMessage}
                                sessionStorageKey={`tiptap-${channelData.name}`}
                                onMessageSend={sendMessage}
                                messageSending={loading}
                                slotBefore={<Flex direction='column' justify='center' hidden={!selectedMessage && !files.length}>
                                    {selectedMessage && <PreviousMessagePreview selectedMessage={selectedMessage} />}
                                    {files && files.length > 0 && <Flex gap='2' width='100%' align='stretch' px='2' p='2' wrap='wrap'>
                                        {files.map((f: CustomFile) => <Box className="grow-0" key={f.fileID}><FileListItem file={f} uploadProgress={fileUploadProgress} removeFile={() => removeFile(f.fileID)} /></Box>)}
                                    </Flex>}
                                    {files.length !== 0 && files.some((f: CustomFile) => isImageFile(f)) && <CompressImageCheckbox compressImages={compressImages} setCompressImages={setCompressImages} />}
                                </Flex>}
                            />
                        }
                    </Stack>
                }

                {shouldShowJoinBox ?
                    <JoinChannelBox
                        channelData={channelData}
                        user={user} /> : null}
                <ArchivedChannelBox
                    channelID={channelData.name}
                    isArchived={channelData.is_archived}
                    isMemberAdmin={channelMemberProfile?.is_admin}
                />
            </FileDrop>
        </ChatBoxBodyContainer>
    )

}

const CompressImageCheckbox = ({ compressImages, setCompressImages }: { compressImages: boolean, setCompressImages: (compressImages: boolean) => void }) => {
    return <div className="px-3">
        <Label size='2' weight='regular'>
            <HStack align='center' gap='2'>
                <Checkbox checked={compressImages} onCheckedChange={() => { setCompressImages(!compressImages) }} />
                Compress Images
            </HStack>
        </Label>
    </div>
}

// Separate container to prevent re-rendering when the threadID changes

const ChatBoxBodyContainer = ({ children }: { children: React.ReactNode }) => {

    const { threadID } = useParams()

    return <div className={clsx("flex flex-col overflow-hidden px-2 pt-16 justify-end h-full", threadID ? "sm:pl-4" : "sm:px-4")}>
        {children}
    </div>
}