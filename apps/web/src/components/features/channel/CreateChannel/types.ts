import { RavenChannel } from '@raven/types/RavenChannelManagement/RavenChannel'
import { UserData } from "@db"

export interface ChannelCreationForm {
    channel_name: string
    channel_description: string
    type: RavenChannel['type']
    members?: UserData[]
}

export type CreateChannelStep = 1 | 2

