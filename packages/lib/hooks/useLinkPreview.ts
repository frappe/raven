import { useFrappeGetCall, useFrappePostCall } from 'frappe-react-sdk'

export type LinkPreviewDetails = {
    title: string
    description: string
    image: string
    force_title: string
    absolute_image: string
    site_name: string
}


export const useLinkPreview = (href: string) => {
    const { data, isLoading } = useFrappeGetCall<{ message: LinkPreviewDetails[] }>(
        'raven.api.preview_links.get_preview_link',
        {
            urls: JSON.stringify([href])
        },
        href ? `link_preview_${href}` : null,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            shouldRetryOnError: false,
        }
    )

    return {
        linkPreview: data?.message?.[0],
        isLoading
    }

}

export const useHideLinkPreview = (messageID: string) => {
    const { call } = useFrappePostCall('raven.api.preview_links.hide_link_preview')

    const hideLinkPreview = () => {
        call({
            message_id: messageID
        })
    }

    return hideLinkPreview
}