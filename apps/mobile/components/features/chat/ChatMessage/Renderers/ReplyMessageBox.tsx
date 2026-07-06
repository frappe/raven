import { Pressable, View, ViewProps } from "react-native";
import { Text } from '@components/nativewindui/Text';
import { Image } from "expo-image";
import { getFileName } from "@raven/lib/utils/operations";
import { useGetUser } from "@raven/lib/hooks/useGetUser";
import useFileURL from "@hooks/useFileURL";
import BarChart from '@assets/icons/BarChart.svg';
import { formatDateAndTime } from "@raven/lib/utils/dateConversions";
import { useColorScheme } from "@hooks/useColorScheme";
import UniversalFileIcon from "@components/common/UniversalFileIcon";
import { useMemo } from "react";

type ReplyMessageBoxProps = ViewProps & {
    message: any
    onPress?: () => void
}

const ReplyMessageBox = ({ message, onPress }: ReplyMessageBoxProps) => {

    const replyMessageDetails = useMemo(() => {
        if (typeof message.replied_message_details === 'string') {
            return JSON.parse(message.replied_message_details)
        } else {
            return message.replied_message_details
        }
    }, [message])

    const user = useGetUser(replyMessageDetails.bot || replyMessageDetails.owner)

    const userFullName = user?.full_name || replyMessageDetails.bot || replyMessageDetails.owner

    const { colors } = useColorScheme()

    const formattedDate = useMemo(() => formatDateAndTime(replyMessageDetails.creation), [replyMessageDetails.creation])

    const renderMessageContent = () => {
        switch (replyMessageDetails.message_type) {
            case 'Poll':
                return (
                    <View className="flex-row items-start gap-1">
                        <BarChart width={18} height={18} fill={colors.icon} />
                        <Text className="text-[15px] line-clamp-2 text-ellipsis overflow-hidden flex-1" numberOfLines={2} ellipsizeMode="tail">
                            Poll: {replyMessageDetails.content?.split("\n")?.[0]}
                        </Text>
                    </View>
                )
            case 'File':
            case 'Image':
                return <ImageFileReplyBlock file={replyMessageDetails.file} messageType={replyMessageDetails.message_type} owner={replyMessageDetails.owner} />

            default:
                return <Text className="text-base text-foreground line-clamp-2 text-ellipsis overflow-hidden flex-1" numberOfLines={2} ellipsizeMode="tail">
                    {replyMessageDetails.content}
                </Text>
        }
    }

    return (
        <Pressable
            onPress={onPress}
            className='flex-1 mt-1.5 p-2 w-full border border-border bg-background rounded-lg ios:active:bg-linkColor/50'
            android_ripple={{ color: 'rgba(0,0,0,0.1)', borderless: false }}>
            <View className="border-l-2 border-border pl-2 gap-2">
                <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-medium" numberOfLines={1}>
                        {userFullName}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                        {formattedDate}
                    </Text>
                </View>
                <View>{renderMessageContent()}</View>
            </View>
        </Pressable>
    )
}

const ImageFileReplyBlock = ({ file, messageType, owner }: { file: string, messageType: string, owner: string }) => {

    const source = useFileURL(file ?? "")
    const fileName = useMemo(() => getFileName(file ?? ""), [file])

    // If the text is too long without any spaces, it will break the layout
    // SO we need to add a space somewhere in the text to break it
    const fileNameWithSpace = useMemo(() => {
        if (fileName.length > 32) {
            // If there's no space in the text, add a space
            if (!fileName.includes(" ")) {
                return (fileName.slice(0, 32) + " " + fileName.slice(32))
            } else {
                return fileName
            }
        }

        return fileName

    }, [fileName])

    return (
        <View className={`flex-row items-start ${messageType === 'Image' ? 'gap-2' : 'gap-1'}`}>
            {messageType === 'Image' ? (
                <Image
                    source={source}
                    alt={`Image sent by ${owner}`}
                    style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                    }}
                    contentFit="cover"
                    transition={200}
                />
            ) : (
                <UniversalFileIcon width={18} height={18} fileName={fileName} />
            )}
            <View className="flex-row items-start gap-1">
                <Text className="text-base line-clamp-2 text-ellipsis overflow-hidden">
                    {fileNameWithSpace}
                </Text>
            </View>
        </View>
    )
}

export default ReplyMessageBox
