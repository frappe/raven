import { RavenChannel } from '@raven/types/RavenChannelManagement/RavenChannel';

interface ChannelIconProps extends React.SVGProps<SVGSVGElement> {
    type: RavenChannel['type']
    className?: string
}

export const ChannelIcon = ({ type, ...props }: ChannelIconProps) => {
    if (!type) return null
    if (type === 'Private') return <Lock {...props} />
    if (type === 'Open') return <Globe {...props} />
    return <Hash {...props} />
}

export const Hash = (props: React.SVGProps<SVGSVGElement>) => {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
        fill="currentColor" viewBox="0 0 24 24" {...props}>
        {/* <!--Boxicons v3.0.8 https://boxicons.com | License  https://docs.boxicons.com/free--> */}
        <path d="M3 14v2h3.73l-.72 3.82 1.97.37.78-4.18h4.96L13 19.83l1.97.37.78-4.18h4.23v-2h-3.86l.75-4h4.11v-2h-3.73l.72-3.82L16 3.83l-.78 4.18h-4.96l.72-3.82-1.97-.37L8.23 8H4v2h3.86l-.75 4zm6.89-4h4.96l-.75 4H9.14z"></path>
    </svg>
}

const Lock = (props: React.SVGProps<SVGSVGElement>) => {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
        fill="currentColor" viewBox="0 0 24 24" {...props}>
        {/* <!--Boxicons v3.0.8 https://boxicons.com | License  https://docs.boxicons.com/free--> */}
        <path d="M6 22h12c1.1 0 2-.9 2-2v-9c0-1.1-.9-2-2-2h-1V7c0-2.76-2.24-5-5-5S7 4.24 7 7v2H6c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2M9 7c0-1.65 1.35-3 3-3s3 1.35 3 3v2H9zm-3 4h12v9H6z"></path>
    </svg>
}

const Globe = (props: React.SVGProps<SVGSVGElement>) => {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
        fill="currentColor" viewBox="0 0 24 24" {...props}>
        {/* <!--Boxicons v3.0.8 https://boxicons.com | License  https://docs.boxicons.com/free--> */}
        <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2m7.93 9h-2.95c-.11-2.44-.62-4.58-1.42-6.15A8.01 8.01 0 0 1 19.93 11M12 20c-1.14 0-2.75-2.7-2.97-7h5.94c-.22 4.3-1.84 7-2.97 7m-2.97-9c.22-4.3 1.84-7 2.97-7s2.75 2.7 2.97 7zm-.59-6.15C7.65 6.43 7.13 8.56 7.02 11H4.07a8.01 8.01 0 0 1 4.37-6.15M4.07 13h2.95c.11 2.44.62 4.58 1.42 6.15A8.01 8.01 0 0 1 4.07 13m11.49 6.15c.79-1.58 1.31-3.71 1.42-6.15h2.95a8.01 8.01 0 0 1-4.37 6.15"></path>
    </svg>
}
