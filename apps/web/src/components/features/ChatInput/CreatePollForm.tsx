import { useFieldArray, useForm } from 'react-hook-form'
import { useFrappePostCall } from 'frappe-react-sdk'
import dayjs from 'dayjs'
import { CalendarClock, EyeOff, ListChecks, ListOrdered, Plus, X } from 'lucide-react'
import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import { Switch } from '@components/ui/switch'
import { Separator } from '@components/ui/separator'
import { DialogFooter } from '@components/ui/dialog'
import { useIsMobile } from '@hooks/use-mobile'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, FormRequiredIndicator } from '@components/ui/form'
import { DataField, DateField, SmallTextField } from '@components/ui/form-elements'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select'
import { H4 } from '@components/ui/typography'
import _ from '@lib/translate'
import { errorResponseToast } from '@components/ui/error-banner'

interface CreatePollFormProps {
    channelID: string
    onClose: () => void
}

interface PollFormData {
    question: string
    /** Object rows (not string[]) — the shape useFieldArray requires. */
    options: { option: string }[]
    is_anonymous: boolean
    is_multi_choice: boolean
    /** Select values are strings; converted on submit. */
    max_choices: string
    auto_close: boolean
    /** YYYY-MM-DD — the DateField contract. */
    end_date: string
    /** HH:mm */
    end_time: string
}

/** Half-hour granularity for the end-time picker. */
const TIME_STEP_SECONDS = 30 * 60

/**
 * Common poll answer sets. They drive the inline ghost-text suggestion: typing a prefix of
 * the first answer (e.g. "Y") suggests it ("Yes"), after which each later row suggests the
 * next answer in the set ("No", then "Maybe"). Purely a convenience — any text is allowed.
 */
const SUGGESTION_SEQUENCES = [
    ['Yes', 'No', 'Maybe'],
    ['Agree', 'Disagree'],
    ['Good', 'Bad', 'Neutral'],
    ['True', 'False'],
]

/**
 * Inline option input with a ghost-text suggestion. When `suggestion` continues what's
 * typed, the remainder shows muted behind the cursor and Tab accepts it. A standard
 * ui/Input under the hood — only the overlay is custom, which is why this can't be a
 * plain DataField (form-elements has no slot for a ghost layer).
 */
const OptionInput = ({
    value,
    suggestion,
    placeholder,
    onChange,
    ref,
}: {
    value: string
    suggestion: string
    placeholder: string
    onChange: (value: string) => void
    /** RHF field ref — lets append({ focusName }) focus the new row's input. */
    ref?: React.Ref<HTMLInputElement>
}) => {
    const remainder = suggestion.toLowerCase().startsWith(value.toLowerCase()) ? suggestion.slice(value.length) : ''
    return (
        <div className="relative flex-1">
            <Input
                ref={ref}
                value={value}
                placeholder={remainder ? '' : placeholder}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Tab' && !e.shiftKey && remainder) {
                        e.preventDefault()
                        onChange(suggestion)
                    }
                }}
            />
            {remainder && (
                // Mirrors the Input's box (border + px-2.5 + text-base) so the invisible
                // spacer lines the remainder up exactly after the typed text.
                <div className="pointer-events-none absolute inset-0 flex items-center whitespace-pre rounded border border-transparent px-2.5 text-base text-ink-gray-4" aria-hidden>
                    <span className="invisible">{value}</span>
                    {remainder}
                </div>
            )}
        </div>
    )
}

/**
 * Poll creation form, built on the standard form stack (react-hook-form +
 * ui/form-elements) — same anatomy as banking's RuleForm: stacked fields with
 * gap-4, a field-array block with per-row remove + an outline "add" button,
 * a Separator, then a titled settings section.
 */
export const CreatePollForm = ({ channelID, onClose }: CreatePollFormProps) => {
    const { call: createPoll, loading: isCreating } = useFrappePostCall('raven.api.raven_poll.create_poll')

    const form = useForm<PollFormData>({
        defaultValues: {
            question: '',
            options: [{ option: '' }, { option: '' }],
            is_anonymous: false,
            is_multi_choice: false,
            max_choices: 'any',
            auto_close: false,
            end_date: '',
            end_time: '17:00',
        },
        mode: 'onChange',
    })

    const { fields, append, remove } = useFieldArray({ control: form.control, name: 'options' })
    const isMobile = useIsMobile()

    const isMultiChoice = form.watch('is_multi_choice')
    const autoClose = form.watch('auto_close')
    const optionValues = form.watch('options')

    // The suggested answer for a row: the first row matches a sequence by its typed prefix;
    // later rows take the next answer from whichever sequence the first row settled on.
    const getSuggestion = (index: number): string => {
        const current = (optionValues[index]?.option ?? '').trim()
        if (index === 0) {
            if (!current) return ''
            return SUGGESTION_SEQUENCES.find((seq) => seq[0].toLowerCase().startsWith(current.toLowerCase()))?.[0] ?? ''
        }
        const first = (optionValues[0]?.option ?? '').trim().toLowerCase()
        return SUGGESTION_SEQUENCES.find((seq) => seq[0].toLowerCase() === first)?.[index] ?? ''
    }

    const onSubmit = (data: PollFormData) => {
        const validOptions = data.options.map((row) => row.option.trim()).filter(Boolean)
        if (validOptions.length < 2) {
            form.setError('options', { message: _('At least 2 options are required') })
            return
        }

        let end_date: string | undefined
        if (data.auto_close && data.end_date) {
            const [hours, minutes] = data.end_time.split(':').map(Number)
            end_date = dayjs(data.end_date).hour(hours).minute(minutes).second(0).format('YYYY-MM-DD HH:mm:ss')
        }

        // The backend posts the poll message to the channel; the realtime echo adds it to the
        // stream, so we just close on success.
        return createPoll({
            channel_id: channelID,
            question: data.question,
            options: validOptions.map((option) => ({ option })),
            is_multi_choice: data.is_multi_choice,
            is_anonymous: data.is_anonymous,
            end_date,
            // "any" = no cap — omit the field entirely. Also no cap with ≤2 valid
            // options: the row is hidden then, so any stored number is stale.
            max_choices:
                data.is_multi_choice && data.max_choices !== 'any' && validOptions.length > 2
                    ? Math.min(Number(data.max_choices) || 2, validOptions.length)
                    : undefined,
        })
            .then(() => onClose())
            .catch((e) => errorResponseToast(_('Could not create poll'), e))
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                <SmallTextField
                    name="question"
                    label={_('Question')}
                    isRequired
                    rules={{ required: _('Poll question is required') }}
                    inputProps={{ placeholder: _('What would you like to ask?'), rows: 2, autoFocus: !isMobile }}
                />

                {/* Options — field-array rows, RuleForm-style: input + always-present
                    remove (disabled at the 2-option minimum) + outline add button */}
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium">
                        {_('Options')}{' '}
                        <FormRequiredIndicator />
                    </span>

                    {fields.map((field, index) => (
                        <div key={field.id} className="flex w-full items-center gap-2">
                            <div className="w-full">
                                {/* FormField (not DataField) so the row stays RHF-registered
                                    while hosting the ghost-suggestion input */}
                                <FormField
                                    control={form.control}
                                    name={`options.${index}.option`}
                                    render={({ field: optionField }) => (
                                        <FormItem>
                                            <FormLabel className="sr-only">{_('Option {0}', [String(index + 1)])}</FormLabel>
                                            <FormControl>
                                                <OptionInput
                                                    ref={optionField.ref}
                                                    value={optionField.value}
                                                    suggestion={getSuggestion(index)}
                                                    placeholder={_('Option {0}', [String(index + 1)])}
                                                    onChange={optionField.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            {/* Removal only makes sense past the 2-option minimum — no
                                disabled placeholder buttons on a fresh form */}
                            {fields.length > 2 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    isIconButton
                                    // Out of the tab order: Tab is for moving input → input
                                    // (and accepting ghost suggestions). Keyboard users lose
                                    // nothing — clearing a row's text removes it at submit.
                                    tabIndex={-1}
                                    onClick={() => remove(index)}
                                    aria-label={_('Remove option {0}', [String(index + 1)])}
                                >
                                    <X />
                                </Button>
                            )}
                        </div>
                    ))}

                    <Button type="button" variant="subtle" size="sm" className="w-fit" onClick={() => append({ option: '' }, { focusName: `options.${fields.length}.option` })}>
                        <Plus />
                        {_('Add option')}
                    </Button>

                    {/* Array-level error slot ("at least 2 options"), set on submit */}
                    <FormField control={form.control} name="options" render={() => <FormItem><FormMessage /></FormItem>} />
                </div>

                <Separator />

                {/* Settings */}
                <div className="flex flex-col gap-4">
                    <H4 className="text-base text-ink-gray-7">{_('Poll Settings')}</H4>

                    <FormField
                        control={form.control}
                        name="is_multi_choice"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between gap-4">
                                <div className="space-y-0.5">
                                    <FormLabel className="flex items-center gap-2"><ListChecks className="h-4 w-4 text-ink-gray-5" />{_('Allow multiple choices')}</FormLabel>
                                    <FormDescription>{_('Voters can select more than one option')}</FormDescription>
                                </div>
                                <FormControl>
                                    <Switch size="md" checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    {/* Same row anatomy as the switch rows — label + description left,
                        compact control right — so the settings list reads as one list.
                        Hidden with only 2 options: "at most 2 of 2" IS "any". */}
                    {isMultiChoice && fields.length > 2 && (
                        <FormField
                            control={form.control}
                            name="max_choices"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between gap-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="flex items-center gap-2"><ListOrdered className="h-4 w-4 text-ink-gray-5" />{_('Maximum choices')}</FormLabel>
                                        <FormDescription>{_('How many options each person can select')}</FormDescription>
                                    </div>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="w-20">
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {/* "Any" (no cap) + 2 … current option-row count */}
                                            <SelectItem value="any">{_('Any')}</SelectItem>
                                            {Array.from({ length: Math.max(fields.length - 1, 1) }, (_unused, i) => String(i + 2)).map((count) => (
                                                <SelectItem key={count} value={count}>
                                                    {count}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                    )}

                    <FormField
                        control={form.control}
                        name="is_anonymous"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between gap-4">
                                <div className="space-y-0.5">
                                    <FormLabel className="flex items-center gap-2"><EyeOff className="h-4 w-4 text-ink-gray-5" />{_('Anonymous poll')}</FormLabel>
                                    <FormDescription>{_('Hide voter identities from other participants')}</FormDescription>
                                </div>
                                <FormControl>
                                    <Switch size="md" checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="auto_close"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between gap-4">
                                <div className="space-y-0.5">
                                    <FormLabel className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-ink-gray-5" />{_('Close this poll automatically')}</FormLabel>
                                    <FormDescription>{_('Stop accepting votes at a chosen date and time')}</FormDescription>
                                </div>
                                <FormControl>
                                    <Switch size="md" checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    {autoClose && (
                        <div className="grid grid-cols-2 gap-2">
                            <DateField
                                name="end_date"
                                label={_('End date')}
                                isRequired
                                rules={{
                                    validate: (value: string) => {
                                        if (!autoClose) return true
                                        if (!value) return _('Pick a date to close the poll on')
                                        return dayjs(value).isBefore(dayjs(), 'day') ? _('The end date must be in the future') : true
                                    },
                                }}
                            />
                            <DataField
                                name="end_time"
                                label={_('End time')}
                                inputProps={{
                                    type: 'time',
                                    step: TIME_STEP_SECONDS,
                                    className: '[&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none',
                                }}
                            />
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" size={isMobile ? 'lg' : 'md'} onClick={onClose} disabled={isCreating}>
                        {_('Cancel')}
                    </Button>
                    <Button type="submit" size={isMobile ? 'lg' : 'md'} loading={isCreating} loadingText={_('Creating...')} disabled={!form.watch('question')?.trim()}>
                        {_('Create Poll')}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    )
}
