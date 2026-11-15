import { describe, expect, it } from 'vitest';
import { terrain } from './terrain.ts';
import {
	CIRCUIT,
	RAMPS,
	ROAD_WIDTH,
	buildTrack,
	groundHeight,
	pointAt,
	roadHeight
} from './track.ts';

const track = buildTrack(CIRCUIT, ROAD_WIDTH, RAMPS);
const ground = terrain(track);

describe('terrain', () => {
	it('sits just under the road everywhere', () => {
		for (let s = 0; s < track.length; s += 37) {
			const p = pointAt(track, s);
			const under = roadHeight(track, s) - ground.height(p.x, p.z);
			expect(under).toBeGreaterThan(0);
			expect(under).toBeLessThan(1);
		}
	});

	it('is level with the road beside it', () => {
		for (let s = 0; s < track.length; s += 53) {
			const p = pointAt(track, s, ROAD_WIDTH / 2 + 8);
			expect(Math.abs(roadHeight(track, s) - ground.height(p.x, p.z))).toBeLessThan(1.5);
		}
	});
});

describe('hills and ramps', () => {
	it('climbs and falls round the lap, back to the start height', () => {
		const heights = track.points.map((p) => p.y);
		expect(Math.max(...heights)).toBeGreaterThan(12);
		expect(heights[0]).toBeCloseTo(0);
	});

	it('ramps rise to their height at the lip, then drop back to the road', () => {
		const r = RAMPS[0];
		expect(groundHeight(track, r.s - 0.1) - roadHeight(track, r.s - 0.1)).toBeCloseTo(r.height, 1);
		expect(groundHeight(track, r.s + 0.1)).toBeCloseTo(roadHeight(track, r.s + 0.1));
		expect(groundHeight(track, r.s - r.length - 1)).toBeCloseTo(
			roadHeight(track, r.s - r.length - 1)
		);
	});

	it('ramps are on straights', () => {
		for (const r of RAMPS) {
			for (let d = -r.length; d < 50; d += 2) {
				const p = track.points[Math.floor((r.s + d) / track.ds)];
				expect(1 / Math.abs(p.curvature)).toBeGreaterThan(100);
			}
		}
	});
});
