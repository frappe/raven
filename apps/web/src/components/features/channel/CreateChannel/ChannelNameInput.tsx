import { useCallback } from 'react'
import { Input } from '@components/ui/input'
import { RavenChannel } from '@raven/types/RavenChannelManagement/RavenChannel'
import { ChannelIcon } from '@components/common/ChannelIcon/ChannelIcon'
import _ from '@lib/translate'

interface ChannelNameInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> {
    value: string
    onChange: (value: string) => void
    channelType: RavenChannel['type']
}

/**
 * The channel name input — custom for the type-icon prefix, the live character
 * counter, and lowercase/hyphen normalisation. Everything else spreads through
 * to the underlying Input: that's what lets the form stack's FormControl reach
 * it (`aria-invalid` → the input's red error border, `id` + `aria-describedby`
 * → the label/description/error wiring). Without the spread, those props died
 * on this wrapper and the field showed the error text but never highlighted.
 */
export const ChannelNameInput = ({ value, onChange, channelType, 'aria-describedby': ariaDescribedBy, ...inputProps }: ChannelNameInputProps) => {
    const handleChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            // Convert to lowercase and replace spaces with hyphens
            const newValue = event.target.value?.toLowerCase().replace(/\s+/g, '-')
            onChange(newValue)
        },
        [onChange]
    )

    return (
        <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-gray-4" aria-hidden="true">
                <ChannelIcon type={channelType} className="h-4 w-4" />
            </div>
            <Input
                {...inputProps}
                value={value}
                onChange={handleChange}
                maxLength={50}
                placeholder={_('e.g. marketing, design-team, project-alpha')}
                className="pl-9 pr-12"
                // No autoFocus attribute — the form is lazy-loaded, so the attribute
                // fires too late on a cold open; CreateChannelForm focuses via ref
                // in a mount effect instead (desktop only).
                // The form's description/error ids (from FormControl) + our counter.
                aria-describedby={[ariaDescribedBy, 'channel-name-counter'].filter(Boolean).join(' ')}
                aria-label={_('Channel name')}
            />
            <div
                id="channel-name-counter"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-gray-4 font-regular"
                aria-live="polite"
                aria-atomic="true"
            >
                <span className="sr-only">{50 - value.length} {_('characters remaining')}</span>
                <span aria-hidden="true">{50 - value.length}</span>
            </div>
        </div>
    )
}
