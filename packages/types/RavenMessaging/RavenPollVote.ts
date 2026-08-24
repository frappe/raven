import { RavenPollVoteSelection } from './RavenPollVoteSelection'

export interface RavenPollVote{
	creation: string
	name: string
	modified: string
	owner: string
	modified_by: string
	docstatus: 0 | 1 | 2
	parent?: string
	parentfield?: string
	parenttype?: string
	idx?: number
	/**	User : Link - Raven User	*/
	user_id: string
	/**	Poll : Link - Raven Poll	*/
	poll_id: string
	/**	Vote Selection : Table - Raven Poll Vote Selection	*/
	vote_selection?: RavenPollVoteSelection[]
}