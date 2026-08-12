import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@components/ui/select"
import _ from "@lib/translate"
import { WorkspaceFields } from "@hooks/useWorkspaces"
import { WorkspaceSelect } from "@components/common/WorkspaceSelect"
import { Search } from "lucide-react"
import { Input } from "@components/ui/input"

export const ChannelFilters = ({ filters, setFilters, workspaces }: { filters: any, setFilters: (filters: any) => void, workspaces: WorkspaceFields[] }) => {
    return (
        <div className="flex items-center gap-2 w-full">
            <div className="relative w-full">
                <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ink-gray-4"
                    aria-hidden="true"
                />
                <Input
                    inputSize="sm"
                    placeholder={_("Search for channels")}
                    value={filters.searchQuery ?? ""}
                    onChange={(e) =>
                        setFilters({ ...filters, searchQuery: e.target.value })
                    }
                    className="pl-9"
                    type="text"
                    aria-label={_("Search channels")}
                    aria-describedby="search-description"
                />
            </div>
            <WorkspaceFilter filters={filters} setFilters={setFilters} workspaces={workspaces} />
            <MyChannelsFilter filters={filters} setFilters={setFilters} />
            <ChannelTypeFilter filters={filters} setFilters={setFilters} />
        </div>
    )
}

const MyChannelsFilter = ({ filters, setFilters }: { filters: any, setFilters: (filters: any) => void }) => {
    return (
        <Select
            value={filters.myChannels}
            onValueChange={(value) => setFilters({ ...filters, myChannels: value })}
        >
            <SelectTrigger inputSize="sm" className="w-40 shrink-0">
                <SelectValue placeholder={_('Select a group')} />
            </SelectTrigger>
            <SelectContent align="start" className="min-w-56 max-w-72">
                <SelectItem value="All Channels">All Channels</SelectItem>
                <SelectItem value="Joined Channels">Joined Channels</SelectItem>
                <SelectItem value="Other Channels">Other Channels</SelectItem>
            </SelectContent>
        </Select>
    )
}

const ChannelTypeFilter = ({ filters, setFilters }: { filters: any, setFilters: (filters: any) => void }) => {

    return (
        <Select
            value={filters.channelType}
            onValueChange={(value) => setFilters({ ...filters, channelType: value })}
        >
            <SelectTrigger inputSize="sm" className="w-40 shrink-0">
                <SelectValue placeholder={_('Select a channel type')} />
            </SelectTrigger>
            <SelectContent align="start" className="min-w-56 max-w-72">
                <SelectItem value="All Types">All Types</SelectItem>
                <SelectItem value="Public">Public</SelectItem>
                <SelectItem value="Private">Private</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
            </SelectContent>
        </Select>
    )
}

const WorkspaceFilter = ({ filters, setFilters, workspaces }: { filters: any, setFilters: (filters: any) => void, workspaces: WorkspaceFields[] }) => {
    return (
        <WorkspaceSelect
            value={filters.workspace}
            onValueChange={(value) => setFilters({ ...filters, workspace: value })}
            workspaces={workspaces}
        />
    )
}
