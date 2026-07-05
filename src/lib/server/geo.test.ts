import { describe, it, expect } from 'vitest';
import {
	haversineMeters,
	checkGeofence,
	roundCoord,
	isValidLatLng,
	MAX_ACCURACY_ALLOWANCE_M
} from './geo';

describe('haversineMeters', () => {
	it('is zero for identical points', () => {
		expect(haversineMeters(37.7793, -122.4192, 37.7793, -122.4192)).toBe(0);
	});

	it('matches a known long distance (SF to LA, ~559 km)', () => {
		const d = haversineMeters(37.7749, -122.4194, 34.0522, -118.2437);
		expect(d).toBeGreaterThan(550_000);
		expect(d).toBeLessThan(570_000);
	});

	it('matches a known short distance (1 degree of latitude ≈ 111.2 km)', () => {
		const d = haversineMeters(0, 0, 1, 0);
		expect(d).toBeGreaterThan(110_500);
		expect(d).toBeLessThan(111_800);
	});

	it('handles the antimeridian', () => {
		const d = haversineMeters(0, 179.9, 0, -179.9);
		expect(d).toBeLessThan(25_000);
	});
});

describe('checkGeofence', () => {
	const origin = { lat: 37.7793, lng: -122.4192 };

	it('passes inside the radius', () => {
		const r = checkGeofence(origin.lat, origin.lng, 100, 37.7795, -122.4192, 10);
		expect(r.ok).toBe(true);
	});

	it('fails outside the radius', () => {
		// ~2.3 km south
		const r = checkGeofence(origin.lat, origin.lng, 250, 37.7585, -122.4194, 10);
		expect(r.ok).toBe(false);
		expect(r.distanceM).toBeGreaterThan(2000);
	});

	it('grants an accuracy allowance for fuzzy indoor GPS', () => {
		// ~150 m away, 100 m radius, 60 m reported accuracy => 100 + 60 >= 150
		const r = checkGeofence(origin.lat, origin.lng, 100, 37.7806, origin.lng, 60);
		expect(r.ok).toBe(true);
	});

	it('caps the allowance so huge claimed accuracy cannot bypass the fence', () => {
		// ~2.3 km away claiming 5 km accuracy: allowance capped at 100 m
		const r = checkGeofence(origin.lat, origin.lng, 100, 37.7585, -122.4194, 5000);
		expect(r.ok).toBe(false);
	});

	it('treats missing/invalid accuracy as zero allowance', () => {
		const r = checkGeofence(origin.lat, origin.lng, 100, 37.7806, origin.lng, undefined);
		expect(r.ok).toBe(false);
		const r2 = checkGeofence(origin.lat, origin.lng, 100, 37.7806, origin.lng, NaN);
		expect(r2.ok).toBe(false);
	});

	it('ignores negative accuracy', () => {
		const r = checkGeofence(origin.lat, origin.lng, 100, 37.7806, origin.lng, -500);
		expect(r.ok).toBe(false);
	});

	it('exports the documented 100 m cap', () => {
		expect(MAX_ACCURACY_ALLOWANCE_M).toBe(100);
	});
});

describe('roundCoord', () => {
	it('rounds to 4 decimal places (~11 m)', () => {
		expect(roundCoord(37.779256789)).toBe(37.7793);
		expect(roundCoord(-122.41923456)).toBe(-122.4192);
	});
});

describe('isValidLatLng', () => {
	it('accepts valid coordinates', () => {
		expect(isValidLatLng(37.7, -122.4)).toBe(true);
		expect(isValidLatLng(-90, 180)).toBe(true);
	});

	it('rejects out-of-range, non-numeric, and non-finite values', () => {
		expect(isValidLatLng(91, 0)).toBe(false);
		expect(isValidLatLng(0, 181)).toBe(false);
		expect(isValidLatLng('37' as unknown, 0)).toBe(false);
		expect(isValidLatLng(NaN, 0)).toBe(false);
		expect(isValidLatLng(Infinity, 0)).toBe(false);
	});
});
