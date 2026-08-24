import clsx from 'clsx'
import { Text, View } from 'react-native'

interface UnreadCountBadgeProps {
    count: number,
    prominent?: boolean
}

const UnreadCountBadge = ({ count, prominent = false }: UnreadCountBadgeProps) => {
    // If count is greater than 9, show 9+
    const displayCount = count > 9 ? '9+' : count
    return (
        <View className={clsx(
            'px-2 py-1 rounded-md',
            prominent 
                ? 'bg-primary' 
                : 'bg-badge-bg'
        )}>
            <Text
                style={{ fontVariant: ['tabular-nums'] }}
                className={clsx(
                    'text-[12px] font-bold',
                    prominent 
                        ? 'text-white' 
                        : 'text-badge-text'
                )}>
                {displayCount}
            </Text>
        </View>
    )
}

export default UnreadCountBadge