type ChannelLike = { name: string; channel_name: string; workspace?: string; is_archived?: 0 | 1 }

/** The workspace's open (not archived) channel with this name, if there is one. Case-blind, like the server's duplicate check. */
export const findExistingChannel = <C extends ChannelLike>(channels: C[], workspace: string | undefined, channelName: string): C | undefined => {
    const wanted = channelName.toLowerCase()
    return channels.find((channel) => channel.workspace === workspace && channel.channel_name.toLowerCase() === wanted && !channel.is_archived)
}
