import { useDoctypePreview } from "@/hooks/useDoctypePreview"
import { AspectRatio, Badge, DataList, DropdownMenu, Flex, Heading, IconButton, Skeleton, Tooltip } from "@radix-ui/themes"
import { FrappeConfig, FrappeContext, useFrappeGetCall } from "frappe-react-sdk"
import { useContext, useMemo, useState } from "react"
import { Grid, Text, Box, Card } from "@radix-ui/themes"
import { toast } from "sonner"
import { BiCopy, BiDotsHorizontalRounded, BiGitPullRequest, BiLinkExternal, BiPrinter, BiRightArrowAlt } from "react-icons/bi"
import useDoctypeMeta from "@/hooks/useDoctypeMeta"
import { HStack } from "@/components/layout/Stack"
import { ErrorBanner, getErrorMessage } from "@/components/layout/AlertBanner/ErrorBanner"
import parse from 'html-react-parser';

export const DoctypeLinkRenderer = ({ doctype, docname }: { doctype: string, docname: string }) => {

    const { data, error, isLoading, mutate } = useDoctypePreview(doctype, docname)

    const route = useMemo(() => {
        if (data && data.raven_document_link) {
            return data.raven_document_link
        }
        const lowerCaseDoctype = doctype.toLowerCase().split(' ').join('-')
        return `${window.location.origin}/desk/${lowerCaseDoctype}/${docname}`
    }, [data, doctype, docname])

    return (
        <Box className='max-w-[550px] min-w-[75px] py-2'>
            {
                isLoading ?
                    <Skeleton className='w-96 h-32 rounded-md' /> :
                    error ?
                        <Card>
                            <ErrorBanner error={error} />
                        </Card> :
                        <DoctypeCard data={data} doctype={doctype} docname={docname} route={route} mutate={mutate} />
            }
        </Box>
    )
}


const DoctypeCard = ({ data, doctype, route, docname, mutate }: {
    data: Record<string, any>,
    doctype: string,
    docname: string,
    route: string,
    mutate: VoidFunction
}) => {

    // utility func to remove known preview fields in order to map rest of them
    const removePreviewFields = (data: Record<string, any>) => {
        const fieldsToRemove = ['preview_image', 'preview_title', 'id', 'raven_document_link']
        return Object.keys(data).reduce((acc, key) => {
            if (!fieldsToRemove.includes(key)) {
                acc[key as keyof typeof data] = data[key]
            }
            return acc
        }, {} as Record<string, any>)
    }

    const onCopyLinkClick = () => {
        toast.promise(() => copyToClipboard(route), {
            loading: 'Copying link...',
            success: 'Link copied!',
            error: 'Failed to copy link'
        })
    }

    const onCopyTextClick = (item: string) => {
        toast.promise(() => copyToClipboard(data[item]), {
            loading: `Copying ${item}...`,
            success: `${item} copied!`,
            error: `Failed to copy ${item}`,
            duration: 1000
        })
    }

    const copyToClipboard = (text: string) => navigator.clipboard.writeText(text)

    return (
        <Card>
            <Grid gap='2'>
                <Flex justify='between' align='start'>
                    <Flex gap='2' align='center' width={'100%'}>
                        {
                            data?.preview_image &&
                            <Box width={'12%'} className="pl-0.5">
                                <AspectRatio ratio={1 / 1}>
                                    <img
                                        src={data.preview_image}
                                        alt={data?.preview_title}
                                        style={{
                                            objectFit: 'cover',
                                            width: '100%',
                                            height: '100%',
                                            // width: '100%',
                                            // minWidth: '50px',
                                            // minHeight: '50px',
                                            // maxWidth: '80px',
                                            // maxHeight: '80px',
                                            backgroundColor: 'var(--gray-5)',
                                            borderRadius: 'var(--radius-4)'
                                        }}
                                    />
                                </AspectRatio>

                            </Box>
                        }
                        <Grid gap='1' width={'100%'}>
                            <Flex gap="1">
                                <Badge variant="surface">{doctype}</Badge>
                                <Text
                                    size='2'
                                    color='gray'
                                    className='cursor-copy'
                                    onClick={() => onCopyTextClick('ID')}
                                >
                                    {data?.id}
                                </Text>
                            </Flex>
                            <Heading as='h3' size='3' className="leading-4 pl-0.5 my-0">{data?.preview_title ?? docname}</Heading>
                        </Grid>
                    </Flex>
                    <Flex gap='3' align='center'>
                        <Tooltip content='Open in new tab' delayDuration={800}>
                            <IconButton
                                size='1'
                                title='Open in new tab'
                                aria-label="Open in new tab"
                                color='gray'
                                asChild
                                variant='ghost'
                            >
                                <a href={route} target="_blank">
                                    <BiLinkExternal size='18' />
                                </a>
                            </IconButton>
                        </Tooltip>

                        {/* <IconButton
                            size='1'
                            title='Open in new tab'
                            aria-label="Open in new tab"
                            color='gray'
                            onClick={openLink}
                            variant='ghost'
                        >
                            <BiDotsVerticalRounded size='18' />
                        </IconButton> */}

                        {/* <Tooltip content='Copy link' delayDuration={800}>
                            <IconButton
                                size='1'
                                title='Copy link'
                                aria-label="Copy link"
                                color='gray'
                                onClick={onCopyLinkClick}
                                variant='ghost'
                            >
                                <BiCopy size='16' />
                            </IconButton>
                        </Tooltip> */}

                        <DoctypeActionMenu doctype={doctype} docname={docname} onCopyLinkClick={onCopyLinkClick} mutate={mutate} />

                        {/* <Tooltip content='Print' delayDuration={800}>
                            <IconButton
                                size='1'
                                title='Print'
                                aria-label="Print"
                                color='gray'
                                onClick={onCopyLinkClick}
                                variant='ghost'
                            >
                                <BiPrinter size='16' />
                            </IconButton>
                        </Tooltip>
                        <Tooltip content='Workflow' delayDuration={800}>
                            <IconButton
                                size='1'
                                title='Print'
                                aria-label="Print"
                                color='gray'
                                onClick={onCopyLinkClick}
                                variant='ghost'
                            >
                                <BiGitMerge size='16' />
                            </IconButton>
                        </Tooltip> */}
                    </Flex>
                </Flex>

                <DataList.Root size='2' className="gap-1 pl-0.5">
                    {
                        data && Object.keys(removePreviewFields(data))?.map((item, index) => (
                            <DataList.Item align='center' key={item}>
                                <DataList.Label minWidth="88px" className="font-medium pr-2">
                                    {item}
                                </DataList.Label>
                                <DataList.Value>
                                    {typeof data[item] === 'string' ? parse(data[item]) : data[item]}
                                </DataList.Value>
                            </DataList.Item>
                        ))
                    }
                </DataList.Root>
            </Grid>
        </Card>
    )
}

const DoctypeActionMenu = ({ doctype, docname, onCopyLinkClick, mutate }: { doctype: string, docname: string, onCopyLinkClick: VoidFunction, mutate: VoidFunction }) => {


    return <DropdownMenu.Root>
        <DropdownMenu.Trigger>
            <IconButton
                size='1'
                title='More actions'
                aria-label="More actions"
                color='gray'
                variant='ghost'
            >
                <BiDotsHorizontalRounded size='20' />
            </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
            <DropdownMenu.Item onSelect={onCopyLinkClick}>
                <Flex gap='2' align='center' pr={'4'}>
                    <BiCopy size={'16'} />
                    Copy Link
                </Flex>
            </DropdownMenu.Item>
            <PrintSubMenu doctype={doctype} docname={docname} />

            <WorkflowSubMenu doctype={doctype} docname={docname} mutate={mutate} />

        </DropdownMenu.Content>
    </DropdownMenu.Root>
}

const WorkflowSubMenu = ({ doctype, docname, mutate }: { doctype: string, docname: string, mutate: VoidFunction }) => {
    const { doc } = useDoctypeMeta(doctype)
    const [open, setOpen] = useState(false)

    if (!doc) return null

    if (!doc?.__workflow_docs || doc?.__workflow_docs.length === 0) return null

    return <DropdownMenu.Sub open={open} onOpenChange={setOpen}>
        <DropdownMenu.SubTrigger>
            <Flex gap='2' align='center'>
                <BiGitPullRequest size={'16'} />
                Workflow
            </Flex>
        </DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent>
            <WorkflowTransitionOptions doctype={doctype} docname={docname} workflow={doc?.__workflow_docs?.[0]} mutate={mutate} />
        </DropdownMenu.SubContent>
    </DropdownMenu.Sub>

}

export interface WorkFlowButtonData {
    action: string;
    doctype: string;
    state: string;
    next_state: string;
    name: string;
    condition: string;
}

const WorkflowTransitionOptions = ({ doctype, docname, mutate }: { doctype: string, docname: string, workflow: any, mutate: VoidFunction }) => {

    const { data: transitions, mutate: refreshTransitions } = useFrappeGetCall<{ message: WorkFlowButtonData[] }>('frappe.model.workflow.get_transitions', {
        'doc': {
            'doctype': doctype,
            'name': docname
        }
    }, `workflow.get_transitions.${doctype}.${docname}`, {
        revalidateIfStale: false,
        revalidateOnFocus: false,
        shouldRetryOnError: false,
    })

    const { call } = useContext(FrappeContext) as FrappeConfig

    const applyTransition = (action: string) => {
        call.post('frappe.model.workflow.apply_workflow', {
            'doc': {
                'doctype': doctype,
                'name': docname
            },
            'action': action
        }).then(() => {
            mutate()
            refreshTransitions()

            toast.success('Workflow transition applied successfully')
        }).catch(error => {
            toast.error('Failed to apply workflow transition', {
                description: getErrorMessage(error)
            })
        })
    }

    if (transitions?.message.length === 0) return <DropdownMenu.Item disabled>No transitions available</DropdownMenu.Item>

    return <>
        {transitions?.message.map((transition) => {
            return <DropdownMenu.Item key={transition.name} onClick={() => applyTransition(transition.action)}>
                <Text size='2' weight='medium'>
                    {transition.action}
                </Text>
                <HStack gap='1'>
                    <Text size='1' className="font-light">{transition.state}</Text>
                    <BiRightArrowAlt size='16' opacity={0.7} />
                    <Text size='1' className="font-light">{transition.next_state}</Text>
                </HStack></DropdownMenu.Item>
        })}
    </>

}

const PrintSubMenu = ({ doctype, docname }: { doctype: string, docname: string }) => {

    const { doc } = useDoctypeMeta(doctype)

    const printit = (format?: string) => {

        let params = `doctype=${encodeURIComponent(doctype)}&name=${encodeURIComponent(docname)}`

        if (format) {
            params += `&format=${format}`
        }

        params += `&trigger_print=0`

        window.open(`/printview?${params}`, '_blank')

    }

    return <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger>
            <Flex gap='2' align='center'>
                <BiPrinter size={'16'} />
                Print
            </Flex>
        </DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent>
            {doc?.__print_formats?.map((format: any) => (
                <DropdownMenu.Item onClick={() => printit(format.name)} key={format.name}>
                    {format.name}
                </DropdownMenu.Item>
            ))
            }
            <DropdownMenu.Item onClick={() => printit()}>Standard</DropdownMenu.Item>
        </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
}