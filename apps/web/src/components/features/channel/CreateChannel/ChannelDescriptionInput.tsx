import { Textarea } from '@components/ui/textarea'
import _ from '@lib/translate'

interface ChannelDescriptionInputProps {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
}

export const ChannelDescriptionInput = ({ value, onChange, disabled }: ChannelDescriptionInputProps) => {
    return (
        <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={_('Add a description to help others understand what this channel is for...')}
            className="resize-none min-h-[80px] max-h-60 overflow-y-auto"
            disabled={disabled}
            aria-label={_('Channel description')}
        />
    )
}
