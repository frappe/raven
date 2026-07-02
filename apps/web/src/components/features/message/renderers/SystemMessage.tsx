import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip";
import { getDateObject } from "@lib/date";
import { timeFormatAtom } from "@utils/preferences";
import { useAtomValue } from "jotai";
import React, { useMemo } from "react";

interface SystemMessageProps {
    message: string
    time: string
}

const SystemMessage: React.FC<SystemMessageProps> = ({ message, time }) => {
    const timeFormat = useAtomValue(timeFormatAtom)


    const { shortTime, longTime } = useMemo(() => {
        try {
            const dateObj = getDateObject(time)
            return {
                shortTime: dateObj.format(timeFormat === "12-hour" ? "hh:mm a" : "HH:mm"),
                longTime: dateObj.format(timeFormat === "12-hour" ? "Do MMMM YYYY, hh:mm a" : "Do MMMM YYYY, HH:mm"),
            }
        }
        catch (error) {
            return {
                shortTime: time,
                longTime: time,
            }
        }
    }, [time])
    return (
        <div className="flex flex-row gap-3 px-3.5 py-2 items-baseline">
            <Tooltip delayDuration={300}>
                <TooltipTrigger>
                    <span className="text-xs text-ink-gray-4 tabular-nums">{shortTime}</span>
                </TooltipTrigger>

                <TooltipContent>
                    {longTime}
                </TooltipContent>
            </Tooltip>
            <span className="text-p-xs text-ink-gray-5">{message}</span>
        </div>
    )
}

export default SystemMessage