const EARTH_RADIUS_M = 6_371_000;

/** Maximum GPS accuracy allowance in meters. Caps how much a voter's
 * self-reported accuracy can widen the fence, so a client claiming 5km
 * "accuracy" cannot bypass a 100m radius. */
export const MAX_ACCURACY_ALLOWANCE_M = 100;

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export interface GeofenceCheck {
	ok: boolean;
	distanceM: number;
}

/**
 * Server-side geofence validation. Runs entirely in memory; voter
 * coordinates must never be persisted or logged.
 */
export function checkGeofence(
	originLat: number,
	originLng: number,
	radiusM: number,
	voterLat: number,
	voterLng: number,
	reportedAccuracyM: number | undefined
): GeofenceCheck {
	const distanceM = haversineMeters(originLat, originLng, voterLat, voterLng);
	const accuracy = Number.isFinite(reportedAccuracyM) ? Math.max(0, reportedAccuracyM as number) : 0;
	const allowance = Math.min(accuracy, MAX_ACCURACY_ALLOWANCE_M);
	return { ok: distanceM <= radiusM + allowance, distanceM };
}

/** Round to 4 decimal places (~11m) before persisting creator coordinates. */
export function roundCoord(value: number): number {
	return Math.round(value * 10_000) / 10_000;
}

export function isValidLatLng(lat: unknown, lng: unknown): lat is number {
	return (
		typeof lat === 'number' &&
		typeof lng === 'number' &&
		Number.isFinite(lat) &&
		Number.isFinite(lng) &&
		lat >= -90 &&
		lat <= 90 &&
		lng >= -180 &&
		lng <= 180
	);
}
