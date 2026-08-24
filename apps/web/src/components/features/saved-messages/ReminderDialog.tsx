import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@components/ui/dialog"
import { Button } from "@components/ui/button"
import { Label } from "@components/ui/label"
import { Textarea } from "@components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover"
import { Calendar } from "@components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { CalendarIcon, Clock } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@lib/utils"

interface ReminderDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSave: (data: { date: Date; time: string; description: string }) => void
    initialDate?: Date
    initialTime?: string
    initialDescription?: string
}

// Time options for the time picker
const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2)
    const minute = i % 2 === 0 ? '00' : '30'
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    const timeString = `${String(displayHour).padStart(2, '0')}:${minute} ${period}`
    const value = `${String(hour).padStart(2, '0')}:${minute}:00`
    return { label: timeString, value }
})

export function ReminderDialog({
    open,
    onOpenChange,
    onSave,
    initialDate,
    initialTime,
    initialDescription = ""
}: ReminderDialogProps) {
    const [date, setDate] = useState<Date | undefined>(initialDate || new Date())
    const [time, setTime] = useState<string>(initialTime || "09:00:00")
    const [description, setDescription] = useState<string>(initialDescription)

    const handleSave = () => {
        if (date) {
            onSave({ date, time, description })
            onOpenChange(false)
        }
    }

    const selectedTimeOption = timeOptions.find(opt => opt.value === time) || timeOptions[0]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>Reminder</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        {/* When (Date) */}
                        <div className="space-y-2">
                            <Label htmlFor="when">When</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="when"
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !date && "text-ink-gray-4"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, "PPP") : "Pick a date"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={setDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Time */}
                        <div className="space-y-2">
                            <Label htmlFor="time">Time</Label>
                            <Select value={time} onValueChange={setTime}>
                                <SelectTrigger id="time" className="w-full">
                                    <Clock className="mr-2 h-4 w-4" />
                                    <SelectValue>{selectedTimeOption.label}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {timeOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Remind me to..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="min-h-[120px]"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button size="md" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button size="md" onClick={handleSave} disabled={!date}>
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

