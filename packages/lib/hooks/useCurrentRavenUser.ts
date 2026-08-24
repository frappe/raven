import { useIsMobile } from '@hooks/use-mobile'
import { RavenUser } from '@raven/types/Raven/RavenUser'
import { useFrappeGetCall } from 'frappe-react-sdk'

const useCurrentRavenUser = () => {

    const isMobile = useIsMobile()
    const { data, mutate } = useFrappeGetCall<{ message: RavenUser }>('raven.api.raven_users.get_current_raven_user',
        undefined,
        'my_profile',
        {
            revalidateIfStale: false,
            revalidateOnFocus: isMobile ? true : false,
            shouldRetryOnError: false,
            revalidateOnReconnect: true
        }
    )

    return {
        myProfile: data?.message,
        mutate
    }

}

export default useCurrentRavenUser