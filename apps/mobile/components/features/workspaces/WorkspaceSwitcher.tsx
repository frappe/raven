import { Sheet, useSheetRef } from '@components/nativewindui/Sheet'
import { Text } from '@components/nativewindui/Text'
import { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet'
import { Pressable, TouchableOpacity, View } from 'react-native'
import UserAvatar from '@components/layout/UserAvatar'
import useFetchWorkspaces, { WorkspaceFields } from '@raven/lib/hooks/useFetchWorkspaces';
import { useCallback, useMemo } from 'react';
import { Divider } from '@components/layout/Divider';
import CheckFilledIcon from '@assets/icons/CheckFilledIcon.svg';
import { useColorScheme } from '@hooks/useColorScheme';
import ChevronDownIcon from '@assets/icons/ChevronDownIcon.svg'
import { COLORS } from '@theme/colors'
import useSiteContext from '@hooks/useSiteContext'
import SiteSwitcher from '../auth/SiteSwitcher'
import { getSiteNameFromUrl } from '@raven/lib/utils/operations'
import ServerIcon from '@assets/icons/ServerIcon.svg'
import AddSite from '../auth/AddSite'
import { FrappeError, useFrappePostCall, useSWRConfig } from 'frappe-react-sdk'
import { toast } from 'sonner-native'
import { getErrorMessage } from '@components/common/ErrorBanner'
import { ActivityIndicator } from '@components/nativewindui/ActivityIndicator'

const WorkspaceSwitcher = ({ workspace, setWorkspace }: { workspace: string, setWorkspace: (workspace: string) => Promise<void> }) => {

    const { data: workspaces } = useFetchWorkspaces()

    const selectedWorkspace = workspaces?.message.find((w: WorkspaceFields) => w.name === workspace)

    if (!selectedWorkspace) return null

    return (
        <WorkSpaceSwitcherMenu
            selectedWorkspace={selectedWorkspace}
            setWorkspace={setWorkspace}
            workspaces={workspaces?.message || []} />
    )
}

const WorkSpaceSwitcherMenu = ({ selectedWorkspace, workspaces, setWorkspace }: { selectedWorkspace: WorkspaceFields, workspaces: WorkspaceFields[], setWorkspace: (workspace: string) => Promise<void> }) => {
    const bottomSheetRef = useSheetRef()

    const onSetWorkspace = useCallback(async (workspace: string) => {
        await setWorkspace(workspace)
        bottomSheetRef.current?.dismiss()
    }, [setWorkspace])

    const logo = getLogo(selectedWorkspace)

    const siteInfo = useSiteContext()

    const urlWithoutProtocol = useMemo(() => {
        return getSiteNameFromUrl(siteInfo?.url)
    }, [siteInfo])

    const addSiteSheetRef = useSheetRef()

    const openAddSiteSheet = useCallback(() => {
        bottomSheetRef.current?.dismiss()
        addSiteSheetRef.current?.present()
    }, [addSiteSheetRef])

    return (
        <View className='flex-1 gap-3'>
            <TouchableOpacity onPress={() => bottomSheetRef.current?.present()}>
                <View className='flex-row items-center gap-2'>
                    <UserAvatar
                        key={logo}
                        alt={selectedWorkspace?.workspace_name ?? 'Workspace Logo'}
                        src={logo}
                        avatarProps={{ className: 'h-10 w-10' }}
                    />
                    <View>
                        <View className='flex-row items-center gap-1'>
                            <Text className="text-white font-bold">{selectedWorkspace?.workspace_name}</Text>
                            <ChevronDownIcon height={20} width={20} fill={COLORS.white} />
                        </View>
                        <Text className='text-xs text-white/90 overflow-hidden text-ellipsis line-clamp-1'>{urlWithoutProtocol}</Text>
                    </View>
                </View>
            </TouchableOpacity>
            <Sheet enableDynamicSizing snapPoints={['60%', '80%']} ref={bottomSheetRef}>
                <BottomSheetScrollView>
                    <View className='flex flex-col gap-4 px-4 pb-24'>
                        <SelectWorkspaceSheet
                            selectedWorkspace={selectedWorkspace}
                            setWorkspace={onSetWorkspace}
                            workspaces={workspaces} />
                        <Divider />
                        <SiteSwitcher openAddSiteSheet={openAddSiteSheet} />
                    </View>
                </BottomSheetScrollView>
            </Sheet>

            <Sheet enableDynamicSizing ref={addSiteSheetRef}>
                <BottomSheetView className='flex-1 pb-16'>
                    <View className='flex-1 gap-2 px-4'>
                        <Text className='text-lg font-semibold'>Add a new site</Text>
                        <AddSite useBottomSheet={true} />
                    </View>
                </BottomSheetView>
            </Sheet>
        </View>
    )
}

type Workspace = WorkspaceFields & { isSelected?: boolean }
interface SelectWorkspaceSheetProps {
    selectedWorkspace: Workspace | undefined,
    workspaces: Workspace[],
    setWorkspace: (workspace: string) => Promise<void>
}

const SelectWorkspaceSheet = ({ selectedWorkspace, workspaces, setWorkspace }: SelectWorkspaceSheetProps) => {

    const { call: joinWorkspace, loading: joiningWorkspace } = useFrappePostCall('raven.api.workspaces.join_workspace')
    const { mutate } = useSWRConfig()

    const { myWorkspaces, otherWorkspaces } = useMemo(() => {
        const myWorkspaces: Workspace[] = []
        const otherWorkspaces: Workspace[] = []

        if (workspaces) {
            workspaces.forEach((workspace) => {
                if (workspace.workspace_member_name) {
                    myWorkspaces.push({
                        ...workspace,
                        isSelected: workspace.name === selectedWorkspace?.name
                    })
                } else {
                    otherWorkspaces.push(workspace)
                }
            })
        }
        return { myWorkspaces, otherWorkspaces }
    }, [workspaces, selectedWorkspace])

    const handleJoinOtherWorkspace = useCallback(
        (workspaceName: string) => {
            const displayName =
                workspaces.find((w) => w.name === workspaceName)?.workspace_name ?? workspaceName

            joinWorkspace({ workspace: workspaceName })
                .then(() => Promise.all([mutate('workspaces_list'), mutate('channel_list')]))
                .then(() => setWorkspace(workspaceName))
                .then(() => {
                    toast.success(`You have joined ${displayName}.`)
                })
                .catch((error: unknown) => {
                    toast.error(
                        getErrorMessage(error as FrappeError) || 'Failed to join the workspace.'
                    )
                })
        },
        [joinWorkspace, setWorkspace, workspaces]
    )

    const siteInfo = useSiteContext()

    const urlWithoutProtocol = useMemo(() => {
        return getSiteNameFromUrl(siteInfo?.url)
    }, [siteInfo])

    const { colors } = useColorScheme()

    return (
        <View className='flex flex-col gap-2'>
            <View className='flex flex-col gap-2'>
                <View className='flex flex-row items-center gap-2'>
                    <ServerIcon height={16} width={16} color={colors.grey} />
                    <Text className='text-sm font-medium text-muted-foreground'>{urlWithoutProtocol}</Text>
                </View>
                <View className='flex flex-col gap-2 border border-border p-2 rounded-xl'>

                    {myWorkspaces.map((workspace, index) => (
                        <WorkspaceRow
                            key={workspace.name}
                            workspace={workspace}
                            setWorkspace={setWorkspace}
                            isLast={index === myWorkspaces.length - 1}
                        />
                    ))}
                </View>
            </View>
            {otherWorkspaces.length > 0 &&
                <View className='flex flex-col gap-2'>
                    <Text className='text-sm font-medium text-muted-foreground'>Other workspaces</Text>
                    <View className='flex flex-col gap-2 border border-border p-2 rounded-xl'>
                        {otherWorkspaces.map((workspace, index) => (
                            <WorkspaceRow key={workspace.name}
                                workspace={workspace}
                                setWorkspace={setWorkspace}
                                isOtherWorkspace
                                isJoining={joiningWorkspace}
                                onJoinOtherWorkspace={handleJoinOtherWorkspace}
                                isLast={index === otherWorkspaces.length - 1}
                            />
                        ))}
                    </View>
                </View>
            }
        </View>
    )
}

type WorkspaceRowProps = {
    workspace: Workspace
    isLast: boolean
    setWorkspace: (workspace: string) => Promise<void>
    isOtherWorkspace?: boolean
    /** True while this row's join request is in flight */
    isJoining?: boolean
    onJoinOtherWorkspace?: (workspaceName: string) => void
}

const WorkspaceRow = ({
    workspace,
    isLast,
    setWorkspace,
    isOtherWorkspace = false,
    isJoining = false,
    onJoinOtherWorkspace,
}: WorkspaceRowProps) => {
    const { colors } = useColorScheme()

    const onPress = () => {
        if (isOtherWorkspace && onJoinOtherWorkspace) {
            void onJoinOtherWorkspace(workspace.name)
            return
        }
        if (!isOtherWorkspace) {
            void setWorkspace(workspace.name)
        }
    }

    const disabled = isOtherWorkspace && isJoining

    return (
        <Pressable
            className='flex flex-col gap-2'
            onPress={onPress}
            disabled={disabled}
        >
            <View className={`flex-row items-center gap-2 ${disabled ? 'opacity-60' : ''}`}>
                <UserAvatar
                    alt={workspace.workspace_name}
                    src={getLogo(workspace)}
                    avatarProps={{ className: 'h-10 w-10 rounded-lg dark:border-border dark:border' }}
                />
                <View className='flex-1'>
                    <Text className='text-sm font-semibold'>{workspace.workspace_name}</Text>
                    <Text className='text-sm text-gray-500'>{workspace.type}</Text>
                </View>
                {isJoining ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                ) : workspace.isSelected ? (
                    <View className='mr-2'>
                        <CheckFilledIcon fill={colors.primary} height={20} width={20} />
                    </View>
                ) : null}
            </View>
            {!isLast && <Divider className='mx-0' />}
        </Pressable>
    )
}

const getLogo = (workspace: WorkspaceFields) => {

    let logo = workspace?.logo || undefined

    if (!logo && workspace?.workspace_name === 'Raven') {
        logo = '/assets/raven/raven-logo.png'
    }

    return logo
}

export default WorkspaceSwitcher
