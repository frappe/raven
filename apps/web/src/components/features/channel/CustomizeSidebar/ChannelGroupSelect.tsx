import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@components/ui/select"
import { Star, Plus, X } from "lucide-react"
import _ from "@lib/translate"
import { NEW_GROUP_VALUE, UNGROUP_VALUE, useChannelGroups } from "./useChannelGroups"
import { GroupNameDialog } from "./GroupNameDialog"


interface ChannelGroupSelectProps {
    channelId: string
    channelGroup: string
}

/** The group cell of the channel table: assign, or create-and-assign in one step. */
export const ChannelGroupSelect = ({ channelId, channelGroup }: ChannelGroupSelectProps) => {
    const { groups, createGroup, assignChannel } = useChannelGroups()

    const [createOpen, setCreateOpen] = useState(false)

    const handleChange = (value: string) => {
        if (value === NEW_GROUP_VALUE) {
            setCreateOpen(true)
            return
        }
        assignChannel(channelId, value === UNGROUP_VALUE ? null : value)
    }

    return (
        <>
            <Select value={channelGroup} onValueChange={handleChange}>
                <SelectTrigger
                    inputSize="sm"
                    className="w-52 **:data-[slot=select-value]:truncate **:data-[slot=select-value]:block"
                >
                    <SelectValue placeholder={_("Select a group")} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Favorites">
                        <div className="flex items-center gap-2">
                            <Star className="fill-yellow-400 stroke-yellow-400" />
                            {_("Favorites")}
                        </div>
                    </SelectItem>
                    {groups.length > 0 && <SelectSeparator />}
                    {groups.map((group) => (
                        <SelectItem
                            key={group.name ?? group.group_name}
                            value={group.group_name}
                            className="overflow-hidden *:last:truncate *:last:block!"
                        >
                            {group.group_name}
                        </SelectItem>
                    ))}
                    <SelectSeparator />
                    {channelGroup && <SelectItem value={UNGROUP_VALUE}>
                        <div className="flex items-center gap-2">
                            <X />
                            {_("Clear")}
                        </div>
                    </SelectItem>}
                    <SelectItem value={NEW_GROUP_VALUE}>
                        <div className="flex items-center gap-2">
                            <Plus />
                            {_("New group")}
                        </div>
                    </SelectItem>
                </SelectContent>
            </Select>

            <GroupNameDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                title={_("New group")}
                submitLabel={_("Create")}
                onSubmit={(name) => createGroup(name, channelId)}
            />
        </>
    )
}
