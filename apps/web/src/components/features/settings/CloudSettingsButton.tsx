import { Button } from '@components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@components/ui/tooltip'
import { useCloudSettings } from '@hooks/useCloudSettings'
import _ from '@lib/translate'
import { CloudIcon } from 'lucide-react'
import { toast } from 'sonner'

export const CloudSettingsButton = () => {
    const { available, opening, open } = useCloudSettings()
    if (!available) return null

    return <Tooltip>
        <TooltipTrigger asChild>
            <Button
                variant="subtle"
                size="md"
                isIconButton
                loading={opening}
                aria-label={_('Cloud Settings')}
                onClick={() => open().catch((error: unknown) => toast.error(
                    error instanceof Error ? error.message : _('Could not open Cloud Settings'),
                ))}
            >
                <CloudIcon className="size-4" />
            </Button>
        </TooltipTrigger>
        <TooltipContent side="right" align="center">{_('Cloud Settings')}</TooltipContent>
    </Tooltip>
}
