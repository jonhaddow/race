import { describe, expect, it } from 'vitest';
import { CIRCUIT, ROAD_WIDTH, buildTrack, locate, pointAt } from './track.ts';

const track = buildTrack(CIRCUIT, ROAD_WIDTH);

describe('circuit', () => {
	it('is about 2 km of evenly spaced samples', () => {
		expect(track.length).toBeGreaterThan(1800);
		expect(track.length).toBeLessThan(3000);
		expect(track.ds).toBeCloseTo(2, 1);
	});

	it('starts heading up the straight (+z)', () => {
		const start = pointAt(track, 0);
		expect(start.x).toBeCloseTo(0, 0);
		expect(start.z).toBeCloseTo(-120, 0);
		expect(start.heading).toBeCloseTo(0, 1);
		// Straight from the grid to past the first ramp.
		for (let d = -40; d <= 110; d += 10) expect(pointAt(track, d).heading).toBeCloseTo(0, 2);
	});

	it('has no bend too tight to ride (radius under 20 m)', () => {
		const tightest = Math.max(...track.points.map((p) => Math.abs(p.curvature)));
		expect(1 / tightest).toBeGreaterThan(20);
	});

	it('never comes near itself, so bikes cannot jump between parts', () => {
		const pts = track.points;
		const n = pts.length;
		let closest = Infinity;
		for (let i = 0; i < n; i += 2) {
			for (let j = i + 2; j < n; j += 2) {
				const apart = Math.min(j - i, n - (j - i)) * track.ds;
				if (apart < 150) continue;
				closest = Math.min(closest, Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z));
			}
		}
		expect(closest).toBeGreaterThan(ROAD_WIDTH * 4);
	});
});

describe('locate', () => {
	it('inverts pointAt, with lateral positive to the right', () => {
		for (const s of [10, 500, 1234.5, track.length - 3]) {
			for (const lat of [-4, 0, 5]) {
				const p = pointAt(track, s, lat);
				const at = locate(track, p.x, p.z);
				expect(at.s).toBeCloseTo(s, 0);
				expect(at.lateral).toBeCloseTo(lat, 0);
			}
		}
	});

	it('puts the right of the start straight (heading +z) at -x', () => {
		expect(pointAt(track, 0, 5).x).toBeCloseTo(-5, 0);
	});

	it('only searches near the hint', () => {
		const p = pointAt(track, 1000);
		const at = locate(track, p.x, p.z, 0);
		expect(at.index).toBeLessThan(30);
	});
});
