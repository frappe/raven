export interface LinkPreviewData {
    title: string
    description: string
    image?: string
    site_name: string
}

export interface LinkPreviewProps {
    href: string
    data: LinkPreviewData
    onHide?: () => void
} 