import { IconButton, Flex, Box } from "@radix-ui/themes"
import { useCallback, useMemo, useRef, useState } from "react"
import { BiX } from "react-icons/bi"
import useFileUpload from "../../chat/ChatInput/FileInput/useFileUpload"
import Tiptap from "../../chat/ChatInput/Tiptap"
import { useSendMessage } from "../../chat/ChatInput/useSendMessage"
import { ReplyMessageBox } from "../../chat/ChatMessage/ReplyMessageBox/ReplyMessageBox"
import { CustomFile, FileDrop } from "../../file-upload/FileDrop"
import { FileListItem } from "../../file-upload/FileListItem"
import { Message } from "../../../../../../types/Messaging/Message"
import ChatStream from "../../chat/ChatStream/ChatStream"
import { JoinChannelBox } from "../../chat/chat-footer/JoinChannelBox"
import { useUserData } from "@/hooks/useUserData"
import useFetchChannelMembers from "@/hooks/fetchers/useFetchChannelMembers"
import ThreadFirstMessage from "./ThreadFirstMessage"
import AIEvent from "../../ai/AIEvent"
import { useTyping } from "../../chat/ChatInput/TypingIndicator/useTypingIndicator"
import TypingIndicator from "../../chat/ChatInput/TypingIndicator/TypingIndicator"
import { Stack } from "@/components/layout/Stack"
import { useSWRConfig } from "frappe-react-sdk"
import { GetMessagesResponse } from "../../chat/ChatStream/useChatStream"
import { RavenMessage } from "@/types/RavenMessaging/RavenMessage"
import { useIsMobile } from "@/hooks/useMediaQuery"

export const ThreadMessages = ({ threadMessage }: { threadMessage: Message }) => {

    const threadID = threadMessage.name
    const channelID = threadMessage.channel_id

    const { channelMembers } = useFetchChannelMembers(channelID ?? '')

    const { stopTyping, onUserType } = useTyping(threadID ?? '')


    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)

    const handleReplyAction = (message: Message) => {
        setSelectedMessage(message)
    }

    const clearSelectedMessage = () => {
        setSelectedMessage(null)
    }

    const scrollRef = useRef<HTMLDivElement>(null)

    const { mutate } = useSWRConfig()

    const onMessageSendCompleted = (messages: RavenMessage[]) => {
        mutate({ path: `get_messages_for_channel_${threadID}` }, (data?: GetMessagesResponse) => {
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

    const { fileInputRef, files, setFiles, removeFile, uploadFiles, addFile, fileUploadProgress } = useFileUpload(threadID ?? '')

    const { sendMessage, loading } = useSendMessage(threadID ?? '', uploadFiles, onMessageSendCompleted, selectedMessage)

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
            tiptapRef.current?.focusEditor()
        }
    }, [isMobile])

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
                    className="z-50"
                    variant="soft"
                    onClick={clearSelectedMessage}>
                    <BiX size='20' />
                </IconButton>
            </ReplyMessageBox>
        }
        return null
    }

    const { name: user } = useUserData()
    const { channelMembers: threadMembers } = useFetchChannelMembers(threadID ?? '')

    const isUserInChannel = useMemo(() => {
        if (user && threadMembers) {
            return user in threadMembers
        }
        return false
    }, [user, threadMembers])



    return (
        <Flex direction='column' justify={'between'} gap='0' className="h-full p-4">
            <FileDrop
                files={files}
                areaHeight="h-[calc(100vh-72px)]"
                height="100%"
                width={'w-[calc((100vw-var(--sidebar-width)-var(--space-8)-var(--space-5))/2)]'}
                ref={fileInputRef}
                onFileChange={setFiles}
                maxFiles={10}
                maxFileSize={10000000}>
                <ThreadFirstMessage message={threadMessage} />
                <ChatStream
                    channelID={threadID ?? ''}
                    scrollRef={scrollRef}
                    ref={chatStreamRef}
                    replyToMessage={handleReplyAction}
                    showThreadButton={false}
                    onModalClose={onModalClose}
                    isChannelReadOnly={!isUserInChannel}
                />
                <AIEvent channelID={threadID ?? ''} />

                {!isUserInChannel && <JoinChannelBox
                    user={user} />}

                {isUserInChannel && <Stack>
                    <TypingIndicator channel={threadID ?? ''} />
                    <Tiptap
                        key={threadID}
                        channelID={threadID}
                        fileProps={{
                            fileInputRef,
                            addFile
                        }}
                        ref={tiptapRef}
                        onUpArrow={onUpArrowPressed}
                        onUserType={onUserType}
                        channelMembers={channelMembers}
                        clearReplyMessage={clearSelectedMessage}
                        replyMessage={selectedMessage}
                        sessionStorageKey={`tiptap-${threadID}`}
                        onMessageSend={sendMessage}
                        messageSending={loading}
                        slotBefore={<Flex direction='column' justify='center' hidden={!selectedMessage && !files.length}>
                            {selectedMessage && <PreviousMessagePreview selectedMessage={selectedMessage} />}
                            {files && files.length > 0 && <Flex gap='2' width='100%' align='end' px='2' p='2' wrap='wrap'>
                                {files.map((f: CustomFile) => <Box className="grow-0" key={f.fileID}><FileListItem file={f} uploadProgress={fileUploadProgress} removeFile={() => removeFile(f.fileID)} /></Box>)}
                            </Flex>}
                        </Flex>}
                    />
                </Stack>}
            </FileDrop>
        </Flex>
    )
}