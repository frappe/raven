import { useState, useEffect, useRef, useContext } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useForm, useWatch } from 'react-hook-form'
import { Button } from '@components/ui/button'
import { toast } from 'sonner'
import { DialogFooter } from '@components/ui/dialog'
import { useIsMobile } from '@hooks/use-mobile'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormRequiredIndicator,
} from '@components/ui/form'
import { SmallTextField } from '@components/ui/form-elements'
import { ChannelNameInput } from './ChannelNameInput'
import { ChannelTypeSelector } from './ChannelTypeSelector'
import { AddMembersStep } from './AddMembersStep'
import { Stepper } from './Stepper'
import { ChannelCreationForm, CreateChannelStep } from './types'
import { FrappeContext, useFrappePostCall, type FrappeConfig } from 'frappe-react-sdk'
import { useNavigate, useParams } from 'react-router'
import { ChannelListItem } from '@raven/types/common/ChannelListItem'
import { channelStore } from '@stores/channels/store'
import { prefetchChannel, type FrappeCallClient } from '@stores/messages/loaders'
import { DRAWER_EXIT_MS } from '@utils/drawer'
import _ from '@lib/translate'
import { cn } from '@lib/utils'
import ErrorBanner from '@components/ui/error-banner'

interface CreateChannelFormProps {
    onClose: () => void
    selectedWorkspace?: string
}

/**
 * Two-step channel creation on the standard form stack (react-hook-form +
 * ui/form-elements). Step 1 CREATES the channel immediately (toast confirms);
 * step 2 adds members to the now-existing channel and only then navigates to
 * it — so there's no "Back" after creation, just Skip. Open channels have no
 * members step (everyone in the workspace is in them by definition) and
 * finish straight from step 1.
 *
 * The name input stays custom (ChannelNameInput): the channel-type icon prefix,
 * live character counter and lowercase/hyphen normalisation have no slot in a
 * plain DataField — same reasoning as the poll form's ghost-suggestion input.
 */
export const CreateChannelForm = ({ onClose: onCloseCallback, selectedWorkspace = '' }: CreateChannelFormProps) => {

    const { workspaceID } = useParams()
    const navigate = useNavigate()
    const isMobile = useIsMobile()
    const workspace = selectedWorkspace || workspaceID || ''

    const { call: createChannel, loading: isCreating, error: createChannelError, reset: resetCreateHook } = useFrappePostCall<{ message: ChannelListItem }>('raven.api.raven_channel.create_channel')
    const { call: addMembers, loading: isAddingMembers, error: addMembersError } = useFrappePostCall('raven.api.raven_channel_member.add_channel_members')

    const reset = () => {
        resetCreateHook()
        resetForm()
    }

    const { call } = useContext(FrappeContext) as FrappeConfig

    /** Cancel / Esc / Skip / done. On desktop the app is ALREADY on the new
     *  channel (we navigate the instant it's created, behind the dialog) —
     *  closing is all that's left. On mobile the create flow deliberately does
     *  NOT navigate (see onSubmit), so if a channel was created, go to it here
     *  — after the drawer has fully closed, or the drawer gets baked into the
     *  OS back-swipe screenshot (see DRAWER_EXIT_MS). The prefetch runs during
     *  the wait so the channel usually opens already loaded. */
    const onClose = () => {
        onCloseCallback()
        const created = createdChannelRef.current
        if (isMobile && created) {
            prefetchChannel(call as FrappeCallClient, created.name)
            window.setTimeout(
                () => navigate(`/${encodeURIComponent(created.workspace)}/${encodeURIComponent(created.name)}`),
                DRAWER_EXIT_MS,
            )
        }
        createdChannelRef.current = null
        reset()
    }

    const [currentStep, setCurrentStep] = useState<CreateChannelStep>(1)
    /** Set once the channel exists on the server — step 2 adds members to IT. */
    const [createdChannel, setCreatedChannel] = useState<{ name: string; workspace: string } | null>(null)
    /** Sync mirror of createdChannel for onClose: the Open-channel path calls
     *  onClose in the same tick as setCreatedChannel, before state commits. */
    const createdChannelRef = useRef<{ name: string; workspace: string } | null>(null)
    const stepContentRef = useRef<HTMLDivElement>(null)
    const nameInputRef = useRef<HTMLInputElement>(null)

    // Focus the name field on mount — as an EFFECT, not the autoFocus attribute:
    // this form is lazy-loaded, so on a cold open it mounts after the dialog's own
    // focus pass has already run, and the attribute loses that race (it only
    // worked on warm opens, when the cached chunk mounts with the dialog).
    // Skipped on mobile: popping the keyboard over a freshly opened sheet is hostile.
    useEffect(() => {
        if (isMobile) return
        const frame = requestAnimationFrame(() => nameInputRef.current?.focus())
        return () => cancelAnimationFrame(frame)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const form = useForm<ChannelCreationForm>({
        defaultValues: {
            type: 'Public',
            channel_name: '',
            channel_description: '',
            members: [],
        },
    })

    const { handleSubmit, control, setValue, reset: resetForm } = form

    const [channelType, selectedMembers = []] = useWatch({ control, name: ['type', 'members'] })

    // Open channels have no members step — everyone's already in.
    const hasMembersStep = channelType !== 'Open'

    // Focus the step content area when the step changes, for screen reader announcement
    useEffect(() => {
        if (stepContentRef.current) {
            stepContentRef.current.focus()
        }
    }, [currentStep])

    // ESC to close the dialog (disabled while a request is in flight)
    useHotkeys('esc', () => onClose(), { enabled: !isCreating && !isAddingMembers, enableOnFormTags: true })

    const onSubmit = async (data: ChannelCreationForm) => {
        // Step 1 (button or Enter in a field): create the channel RIGHT AWAY.
        // Desktop also navigates to it behind the still-open dialog — the dialog
        // is mounted from the sidebar, which survives the route change, so
        // members are picked with the channel already visible underneath.
        // Mobile does NOT navigate here: the drawer covers the screen (nothing
        // to see underneath), and navigating under an open drawer bakes it into
        // the OS back-swipe screenshot — the navigation happens in onClose,
        // after the drawer has fully closed. Open channels have no members
        // step, so for them create → (navigate) → close.
        if (!createdChannel) {
            createChannel({
                type: data.type,
                channel_name: data.channel_name,
                channel_description: data.channel_description,
                workspace,
            }).then((result) => {
                const channel = result.message
                // Optimistically add the new channel to the store (the creator is admin).
                channelStore.upsertChannel({ ...channel, is_admin: 1, allow_notifications: 1 })
                toast.success(_('Channel created'))
                if (!isMobile) navigate(`/${encodeURIComponent(workspace)}/${encodeURIComponent(channel.name)}`)
                createdChannelRef.current = { name: channel.name, workspace }
                setCreatedChannel({ name: channel.name, workspace })
                if (hasMembersStep) setCurrentStep(2)
                else onClose()
            }).catch(() => {
                // The banner below the stepper shows the error; nothing to undo.
            })
            return
        }
        // Step 2: add the selected members to the channel (desktop is already
        // on it; mobile goes there on close), then close.
        const memberIds = (data.members ?? []).map((member) => member.name)
        addMembers({
            channel_id: createdChannel.name,
            members: memberIds,
        }).then(() => {
            toast.success(
                memberIds.length === 1
                    ? _('1 member added')
                    : _('{0} members added', [String(memberIds.length)]),
            )
            onClose()
        }).catch(() => {
            // Banner shows the error — the user can retry or Skip.
        })
    }

    const addLabel =
        selectedMembers.length === 1
            ? _('Add 1 member')
            : _('Add {0} members', [String(selectedMembers.length)])

    return (
        // Pure content — the hosting dialog/drawer owns the title, description and
        // outer padding (they must exist when the surface MOUNTS, and this form is
        // lazy-loaded). One flex column with gaps; no margin choreography.
        <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
                {/* Stepper — always rendered so switching the channel type doesn't shift
                    the layout; Open channels just show the members step as disabled. */}
                <Stepper
                    steps={[
                        { id: 1, title: _('Channel Details') },
                        { id: 2, title: _('Add Members'), disabled: !hasMembersStep },
                    ]}
                    currentStep={currentStep - 1}
                />

                {/* Request errors surface below the stepper, on whichever step they
                    belong to: creation errors on step 1, add-members errors on step 2. */}
                {createChannelError ? <ErrorBanner error={createChannelError} /> : null}
                {addMembersError ? <ErrorBanner error={addMembersError} /> : null}

                {/* Step content — BOTH steps stay mounted, stacked in the same grid cell.
                    The cell sizes itself to the taller step (step 1's natural height), so:
                    no hard-coded height, step 1 never scrolls on desktop, the member list
                    on step 2 inherits a definite height to scroll INTERNALLY, and switching
                    steps can't resize the dialog. `invisible` (not display:none) keeps the
                    hidden step in the layout while removing it from tab order and the
                    accessibility tree.

                    The p-1/-m-1 pairs add clip headroom without shifting layout: overflow
                    containers clip at their padding edge, and focus rings extend ~3px
                    OUTSIDE an element — flush against the container they'd get sliced. */}
                <div
                    ref={stepContentRef}
                    className="grid min-h-0 overflow-hidden -m-1 p-1"
                    tabIndex={-1}
                >
                    <div
                        className={cn(
                            '[grid-area:1/1] flex min-h-0 flex-col gap-4 overflow-y-auto -m-1 p-1',
                            currentStep !== 1 && 'invisible',
                        )}
                        role="group"
                        aria-label={_('Channel details')}
                    >
                            <FormField
                                control={control}
                                name="channel_name"
                                rules={{
                                    required: _('Please add a channel name'),
                                    maxLength: {
                                        value: 50,
                                        message:
                                            _('Channel name cannot be more than 50 characters.'),
                                    },
                                    minLength: {
                                        value: 3,
                                        message:
                                            _('Channel name cannot be less than 3 characters.'),
                                    },
                                    pattern: {
                                        value: /^[a-zA-Z0-9][a-zA-Z0-9-]*$/,
                                        message:
                                            _('Channel name can only contain letters, numbers and hyphens.'),
                                    },
                                }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {_('Name')}
                                            <FormRequiredIndicator />
                                        </FormLabel>
                                        <FormControl>
                                            <ChannelNameInput
                                                ref={nameInputRef}
                                                value={field.value}
                                                onChange={field.onChange}
                                                channelType={channelType}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Unmarked = optional (required fields carry the indicator) */}
                            <SmallTextField
                                name="channel_description"
                                label={_('Description')}
                                formDescription={_('What is this channel about?')}
                                inputProps={{
                                    placeholder: _('Add a description to help others understand what this channel is for...'),
                                    rows: 3,
                                    className: 'resize-none max-h-60 overflow-y-auto',
                                }}
                            />

                            <FormField
                                control={control}
                                name="type"
                                render={({ field }) => (
                                    <ChannelTypeSelector
                                        value={field.value}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                    </div>

                    <div
                        role="group"
                        aria-label={_('Add members')}
                        className={cn('[grid-area:1/1] min-h-0', currentStep !== 2 && 'invisible')}
                    >
                        <AddMembersStep
                            selectedUsers={selectedMembers || []}
                            onSelectUsers={(users) => setValue('members', users)}
                            workspace={workspace}
                        />
                    </div>
                </div>

                {/* Standard dialog footer. Step 1: Cancel / Create (the channel is
                    created HERE). Step 2: the channel already exists, so there's no
                    Back — Skip goes straight to it, the primary adds the selection. */}
                <DialogFooter>
                    {currentStep === 1 ? (
                        <>
                            <Button type="button" variant="outline" size={isMobile ? 'lg' : 'md'} onClick={() => onClose()} disabled={isCreating}>
                                {_('Cancel')}
                            </Button>
                            <Button type="submit" size={isMobile ? 'lg' : 'md'} loading={isCreating} loadingText={_('Creating...')}>
                                {_('Create Channel')}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                size={isMobile ? 'lg' : 'md'}
                                onClick={() => onClose()}
                                disabled={isAddingMembers}
                            >
                                {_('Skip for now')}
                            </Button>
                            <Button
                                type="submit"
                                size={isMobile ? 'lg' : 'md'}
                                loading={isAddingMembers}
                                loadingText={_('Adding...')}
                                disabled={selectedMembers.length === 0}
                            >
                                {addLabel}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </form>
        </Form>
    )
}
