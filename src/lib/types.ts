export interface PollOptionView {
	id: number;
	label: string;
}

export interface PollView {
	id: string;
	question: string;
	isAnonymous: boolean;
	allowMulti: boolean;
	allowWritein: boolean;
	resultsVisibility: 'live' | 'after_close';
	geofenced: boolean;
	geofenceRadiusM: number | null;
	status: 'open' | 'closed';
	createdAt: number;
	expiresAt: number;
	options: PollOptionView[];
}

export interface ResultsView {
	status: 'open' | 'closed';
	total: number;
	/** Current option list; write-in polls grow it while voting is open. */
	options: PollOptionView[];
	counts: Record<string, number> | null;
	voters: string[] | null;
	closesAt: number;
	serverNow: number;
}
