/** Shared input constraints. Server-side enforcement is authoritative;
 * the client uses the same limits for friendlier UX. */

export const QUESTION_MAX = 200;
export const OPTION_MAX = 80;
export const NAME_MAX = 40;
export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 8;
/** Hard ceiling on options once voter write-ins are enabled. */
export const WRITEIN_TOTAL_MAX = 20;

export const RADII_M = [100, 250, 1000, 5000] as const;

export const EXPIRY_CHOICES = {
	'1h': 3600,
	'4h': 14_400,
	'24h': 86_400,
	'7d': 604_800
} as const;
export type ExpiryKey = keyof typeof EXPIRY_CHOICES;
export const DEFAULT_EXPIRY: ExpiryKey = '24h';

export const GRACE_SECONDS = 86_400; // results stay visible 24h after expiry

/** Strip HTML tags and control characters, collapse whitespace, trim. */
export function sanitizeText(raw: unknown, maxLength: number): string {
	if (typeof raw !== 'string') return '';
	// Strip tags until the text stops changing: one pass can splice leftovers
	// into a fresh tag (`<<a>script>` -> `<script>`). The [<>] sweep below is
	// what actually guarantees no markup survives, but leaving a single pass
	// here means the intermediate text is a lie about what was removed.
	let text = raw;
	let previous: string;
	do {
		previous = text;
		text = text.replace(/<[^>]*>/g, '');
	} while (text !== previous);
	return (
		text
			.replace(/[<>]/g, '')
			// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is this function's job
			.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, maxLength)
	);
}

export function isValidRadius(value: unknown): value is (typeof RADII_M)[number] {
	return typeof value === 'number' && (RADII_M as readonly number[]).includes(value);
}

export function isValidExpiry(value: unknown): value is ExpiryKey {
	return typeof value === 'string' && value in EXPIRY_CHOICES;
}
