export interface PollOptionView {
	id: number;
	label: string;
}

export interface PollView {
	id: string;
	question: string;
	isAnonymous: boolean;
	allowMulti: boolean;
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
	counts: Record<string, number> | null;
	voters: string[] | null;
	closesAt: number;
	serverNow: number;
}
