import { RadioGroup, RadioGroupItem } from '@components/ui/radio-group'
import {
    FormControl,
    FormItem,
    FormLabel,
    FormMessage,
} from '@components/ui/form'
import { RavenChannel } from '@raven/types/RavenChannelManagement/RavenChannel'
import { ChannelIcon } from '@components/common/ChannelIcon/ChannelIcon'
import { cn } from '@lib/utils'
import _ from '@lib/translate'

interface ChannelTypeSelectorProps {
    value: RavenChannel['type']
    onChange: (value: RavenChannel['type']) => void
}

const CHANNEL_TYPES: { value: RavenChannel['type']; label: string; description: string }[] = [
    { value: 'Public', label: _('Public'), description: _('Anyone can view but is not a member by default') },
    { value: 'Private', label: _('Private'), description: _('Join by invitation only') },
    { value: 'Open', label: _('Open'), description: _('Everyone is a member') },
]

/**
 * Channel type as selectable CARDS — icon + name + a short description in each
 * box (the banking RuleForm's transaction-type pattern: sr-only peer radio,
 * the styled label IS the clickable box).
 */
export const ChannelTypeSelector = ({ value, onChange }: ChannelTypeSelectorProps) => {
    return (
        <FormItem>
            <FormLabel>{_('Channel Type')}</FormLabel>
            <FormControl>
                <RadioGroup
                    onValueChange={onChange}
                    value={value}
                    className="flex flex-col gap-2"
                    aria-label={_('Select channel type')}
                >
                    {CHANNEL_TYPES.map((type) => (
                        <FormItem key={type.value} className="flex">
                            <FormControl>
                                <RadioGroupItem value={type.value} className="peer sr-only" />
                            </FormControl>
                            <FormLabel
                                className={cn(
                                    // items-start + text-left: the ui FormLabel's base items-center would centre the stacked content
                                    'flex w-full cursor-pointer flex-col items-start gap-1 rounded-md border border-outline-gray-2 p-3 text-left transition-colors hover:bg-surface-gray-1',
                                    'peer-data-[state=checked]:border-outline-gray-5 peer-data-[state=checked]:bg-surface-gray-2',
                                    // The radio itself is sr-only, so KEYBOARD focus (Tab into the
                                    // group, arrows between options) must show on the card instead —
                                    // without this the group looked unfocusable.
                                    'peer-focus-visible:ring-2 peer-focus-visible:ring-outline-gray-3 peer-focus-visible:ring-offset-1',
                                )}
                            >
                                <span className="flex items-center gap-1.5 text-sm font-medium text-ink-gray-8">
                                    <ChannelIcon type={type.value} className="h-4 w-4 text-ink-gray-6" />
                                    {type.label}
                                </span>
                                <span className="text-xs font-normal text-ink-gray-5">{type.description}</span>
                            </FormLabel>
                        </FormItem>
                    ))}
                </RadioGroup>
            </FormControl>
            <FormMessage />
        </FormItem>
    )
}
