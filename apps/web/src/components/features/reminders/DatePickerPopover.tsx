import { useState } from "react"
import dayjs from "dayjs"
import { CalendarIcon } from "lucide-react"
import { Button } from "@components/ui/button"
import { Calendar } from "@components/ui/calendar"
import { Input } from "@components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover"
import { formatDate, parseTypedDate, USER_DATE_FORMAT } from "@lib/date"
import { cn } from "@lib/utils"
import _ from "@lib/translate"

type DatePickerPopoverProps = {
    /** The currently picked date — always set (seeded by the caller). */
    value: Date
    /** Called with the picked date. */
    onChange: (date: Date) => void
    /** Input size — mobile surfaces pass "lg" for touch targets. */
    size?: "sm" | "md" | "lg"
    /** Root wrapper — the row decides the field's width. */
    className?: string
}

/** Typeable date field + calendar popover, sans react-hook-form. */
export const DatePickerPopover = ({ value, onChange, size = "sm", className }: DatePickerPopoverProps) => {
    const [open, setOpen] = useState(false)
    // Display state only — blur resnaps to `value`, discarding unparseable leftovers.
    const [text, setText] = useState(() => formatDate(value))

    const commitTyped = (raw: string) => {
        setText(raw)
        const parsed = parseTypedDate(raw)
        // Same floor as the calendar's disabled days — typed past dates don't commit.
        if (parsed && !dayjs(parsed).isBefore(dayjs(), "day")) onChange(parsed)
    }

    return (
        <div className={cn("relative min-w-0", className)}>
            {/* min-w-0: the input's intrinsic min-width would steal the time select's share. */}
            <Input
                inputSize={size}
                className="w-full min-w-0 pe-9"
                placeholder={USER_DATE_FORMAT}
                aria-label={_("Date")}
                value={text}
                onChange={(e) => commitTyped(e.target.value)}
                onBlur={() => setText(formatDate(value))}
                onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                        e.preventDefault()
                        setOpen(true)
                    }
                }}
            />
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        isIconButton
                        aria-label={_("Select date")}
                        className="absolute top-1/2 -translate-y-1/2 ltr:right-1.5 rtl:left-1.5"
                    >
                        <CalendarIcon />
                    </Button>
                </PopoverTrigger>
                {/* collisionPadding 16 = the sheets' px-4 gutter. */}
                <PopoverContent
                    className="w-auto p-0"
                    align="start"
                    collisionPadding={16}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <Calendar
                        mode="single"
                        selected={value}
                        onSelect={(picked) => {
                            if (picked) {
                                onChange(picked)
                                setText(formatDate(picked))
                                setOpen(false)
                            }
                        }}
                        disabled={{ before: new Date() }}
                        // 6 fixed week rows — month navigation must not resize the popover.
                        fixedWeeks
                        // 44px date cells on mobile — fingers need more than the 32px default.
                        className="[--cell-size:--spacing(11)] md:[--cell-size:--spacing(8)]"
                    />
                </PopoverContent>
            </Popover>
        </div>
    )
}
