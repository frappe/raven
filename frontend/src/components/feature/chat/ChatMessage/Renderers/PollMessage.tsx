import { Box, Checkbox, Flex, Text, RadioGroup, Button, Badge, BoxProps, Tooltip } from "@radix-ui/themes"
import { useEffect, useMemo, useState } from "react"
import { UserFields } from "../../../../../utils/users/UserListProvider"
import { PollMessage } from "../../../../../../../types/Messaging/Message"
import { useFrappeDocumentEventListener, useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk"
import { RavenPoll } from "@/types/RavenMessaging/RavenPoll"
import { ErrorBanner, getErrorMessage } from "@/components/layout/AlertBanner/ErrorBanner"
import { RavenPollOption } from "@/types/RavenMessaging/RavenPollOption"

import { ViewPollVotes } from "@/components/feature/polls/ViewPollVotes"
import { toast } from "sonner"
import { IoLockClosed } from "react-icons/io5"

type PollMessageBlockProps = BoxProps & {
    message: PollMessage,
    user?: UserFields,
    isChannelReadOnly?: boolean,
}

export interface Poll {
    'poll': RavenPoll,
    'current_user_votes': { 'option': string }[]
}

export const PollMessageBlock = ({ message, user, isChannelReadOnly = false, ...props }: PollMessageBlockProps) => {

    // fetch poll data using message_id
    const { data, error, mutate } = useFrappeGetCall<{ message: Poll }>('raven.api.raven_poll.get_poll', {
        'message_id': message.name,
    }, `poll_data_${message.poll_id}`, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false
    })

    useFrappeDocumentEventListener('Raven Poll', message.poll_id, () => {
        mutate()
    })

    return (
        <Box {...props} pt='1'>
            <ErrorBanner error={error} />
            {data && <PollMessageBox data={data.message} messageID={message.name} isChannelReadOnly={isChannelReadOnly} />}
        </Box>
    )
}

const PollMessageBox = ({ data, messageID, isChannelReadOnly }: { data: Poll, messageID: string, isChannelReadOnly: boolean }) => {
    const isReadOnly = !!data.poll.is_disabled || isChannelReadOnly
    return (
        <Flex align='center' gap='4' p='2' className={`bg-gray-2
        shadow-sm
        dark:bg-gray-3
        min-w-64
        max-w-[420px]
        w-full
        rounded-md
        ${isReadOnly ? '' : 'group-hover:bg-accent-a2 dark:group-hover:bg-gray-4 group-hover:transition-all group-hover:delay-100'}`}>
            <Flex direction='column' gap='2' p='2' className="w-full">
                <Flex direction='column' gap='2'>
                    <Flex justify='between' align='center' gap='2'>
                        <Text size='2' weight={'medium'}>{data.poll.question}</Text>
                        {data.poll.is_anonymous ? <Badge color='blue' className={'w-fit'}>Anonymous</Badge> : null}
                    </Flex>
                    {data.poll.is_disabled ? <Text color="gray" size='1'>
                        Poll is now closed. No more votes will be accepted.
                    </Text> : null}
                    {!data.poll.is_disabled && isChannelReadOnly ? <Text color="gray" size='1'>
                        Join this channel to vote in this poll.
                    </Text> : null}
                    {data.poll.end_date && !data.poll.is_disabled && (
                        <Text size='1' color='gray'>
                            This poll will end on {new Date(data.poll.end_date).toLocaleString()}.
                        </Text>
                    )}
                </Flex>
                {data.current_user_votes.length > 0 ?
                    <PollResults data={data} /> :
                    <>
                        {data.poll.is_multi_choice ?
                            <MultiChoicePoll data={data} messageID={messageID} isReadOnly={isReadOnly} /> :
                            <SingleChoicePoll data={data} messageID={messageID} isReadOnly={isReadOnly} />
                        }
                    </>
                }
                {data.poll.is_anonymous ? null : <ViewPollVotes poll={data} />}
            </Flex>
        </Flex>
    )
}

const PollResults = ({ data }: { data: Poll }) => {
    return (
        <Flex direction='column' gap='2' className="w-full">
            {data.poll.options.map(option => {
                return <PollOption key={option.name} data={data} option={option} />
            })}
            <Text as='span' size='1' color='gray' className="px-2">{data.poll.total_votes} vote{data.poll.total_votes > 1 ? 's' : ''}</Text>
        </Flex>
    )
}

const PollOption = ({ data, option }: { data: Poll, option: RavenPollOption }) => {

    // State to track whether the animation should be triggered
    const [triggerAnimation, setTriggerAnimation] = useState<boolean>(false)

    // Use useEffect to trigger animation after the component is mounted
    useEffect(() => {
        setTriggerAnimation(true)
    }, [data])

    const isCurrentUserVote = useMemo(() => {
        return data.current_user_votes.some(vote => vote.option === option.name)
    }, [data.current_user_votes, option.name])

    const percentage = useMemo(() => {

        const getPercentage = (votes: number) => {
            if (data.poll.is_multi_choice) {
                const totalVotes = data.poll.options.reduce((acc, opt) => acc + (opt.votes ?? 0), 0)
                return (votes / totalVotes) * 100
            } else return (votes / data.poll.total_votes) * 100
        }

        return getPercentage(option.votes ?? 0)
    }, [option.votes, data])

    const width = `${percentage}%`

    return (
        <Tooltip content={`${option.votes} vote${option.votes && option.votes === 1 ? '' : 's'}`}>
            <Flex key={option.name} justify='between' align='center' className={'relative'}>
                <Box position='absolute' top='0' left='0'
                    data-is-current-user-vote={isCurrentUserVote}
                    className={`bg-gray-5
                            dark:bg-gray-6
                            h-full
                            rounded-sm
                            data-[is-current-user-vote=true]:bg-accent-a5
                            dark:data-[is-current-user-vote=true]:bg-accent-a6`}
                    style={{ width: triggerAnimation ? width : 0, transition: 'width 0.5s ease-in-out' }}>
                </Box>
                <Text as='span' size='2' className="px-2 py-1 z-10 overflow-hidden text-ellipsis" weight={isCurrentUserVote ? 'bold' : 'regular'}>{option.option}</Text>
                <Text as='span' size='2' className="px-2 py-1 z-10 w-[6ch] text-right" weight={isCurrentUserVote ? 'bold' : 'regular'}>{percentage.toFixed(1)}%</Text>
            </Flex>
        </Tooltip>
    )
}

const SingleChoicePoll = ({ data, messageID, isReadOnly }: { data: Poll, messageID: string, isReadOnly: boolean }) => {

    const { call } = useFrappePostCall('raven.api.raven_poll.add_vote')
    const onVoteSubmit = async (option: RavenPollOption) => {
        if (isReadOnly) return
        return call({
            'message_id': messageID,
            'option_id': option.name
        }).then(() => {
            toast.success('Your vote has been submitted!')
        }).catch((error) => {
            toast.error("There was an error submitting your vote.", {
                description: getErrorMessage(error)
            })
        })
    }

    return (
        <RadioGroup.Root>
            {data.poll.options.map(option => (
                <div key={option.name}>
                    <Text as="label" size="2" className="block w-full">
                        <Flex gap="2" p='2' className={`rounded-sm w-full ${isReadOnly ? '' : 'hover:bg-accent-a2 dark:hover:bg-gray-5'}`}>
                            <RadioGroup.Item
                                disabled={isReadOnly}
                                value={option.name}
                                onClick={() => onVoteSubmit(option)}
                                className="shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                                <span className="break-words overflow-hidden block">{option.option}</span>
                            </div>
                        </Flex>
                    </Text>
                </div>
            ))}
        </RadioGroup.Root>
    )
}

const MultiChoicePoll = ({ data, messageID, isReadOnly }: { data: Poll, messageID: string, isReadOnly: boolean }) => {

    const [selectedOptions, setSelectedOptions] = useState<string[]>([])

    const handleCheckboxChange = (name: string, value: boolean | string) => {
        if (value) {
            setSelectedOptions((opts) => [...opts, name])
        } else {
            setSelectedOptions((opts) => opts.filter(opt => opt !== name))
        }
    }

    const { call } = useFrappePostCall('raven.api.raven_poll.add_vote')
    const onVoteSubmit = async () => {
        if (isReadOnly) return
        if (!selectedOptions.length) {
            toast.error('Please select at least one option')
            return
        }
        return call({
            'message_id': messageID,
            'option_id': selectedOptions
        }).then(() => {
            toast.success('Your vote has been submitted!')
        }).catch((error) => {
            toast.error("There was an error submitting your vote.", {
                description: getErrorMessage(error)
            })
        })
    }

    const footerText = data.poll.is_disabled
        ? 'This poll is closed and no longer accepting votes'
        : 'To view the poll results, please submit your choice(s)'

    return (
        <div>
            {data.poll.options.map(option => (
                <div key={option.name}>
                    <Text as="label" size="2" className="block w-full">
                        <Flex gap="2" p='2' className={`rounded-sm w-full ${isReadOnly ? '' : 'hover:bg-accent-a2 dark:hover:bg-gray-5'}`}>
                            <Checkbox
                                disabled={isReadOnly}
                                value={option.name}
                                onCheckedChange={(v) => handleCheckboxChange(option.name, v)}
                                className="shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                                <span className="break-words overflow-hidden block">{option.option}</span>
                            </div>
                        </Flex>
                    </Text>
                </div>
            ))}
            <Flex justify={'between'} align={'center'} gap={'2'}>
                <Text size='1' className="text-gray-500 px-2 py-1">
                    {footerText}
                </Text>
                {!isReadOnly && (
                    <Button size={'1'} variant={'soft'} style={{ alignSelf: 'flex-end' }} onClick={onVoteSubmit}>Submit</Button>
                )}
            </Flex>
        </div>
    )
}