import { describe, expect, it } from 'vitest';
import { pace, stepRider, type Rider } from './ai.ts';
import { GRIP } from './bike.ts';
import { CIRCUIT, ROAD_WIDTH, buildTrack, sample } from './track.ts';

const track = buildTrack(CIRCUIT, ROAD_WIDTH);

describe('stepRider', () => {
	it('laps in a sensible time, staying on the road and within grip', () => {
		const rider: Rider = {
			progress: 0,
			lateral: 0,
			speed: 0,
			lean: 0,
			y: 0,
			vy: 0,
			air: false,
			airtime: 0,
			skill: 0.9,
			lane: 2
		};
		let t = 0;
		let worstGrip = 0;
		while (rider.progress < track.length && t < 300) {
			stepRider(rider, track, 1 / 60);
			t += 1 / 60;
			expect(Math.abs(rider.lateral)).toBeLessThan(ROAD_WIDTH / 2);
			const k = Math.abs(sample(track, rider.progress).curvature);
			worstGrip = Math.max(worstGrip, rider.speed * rider.speed * k);
		}
		expect(t).toBeGreaterThan(40);
		expect(t).toBeLessThan(110);
		expect(worstGrip).toBeLessThan(GRIP * 1.1);
	});

	it('a more skilled rider is quicker', () => {
		const lap = (skill: number) => {
			const r: Rider = {
				progress: 0,
				lateral: 0,
				speed: 0,
				lean: 0,
				y: 0,
				vy: 0,
				air: false,
				airtime: 0,
				skill,
				lane: 0
			};
			let t = 0;
			while (r.progress < track.length) {
				stepRider(r, track, 1 / 30);
				t += 1 / 30;
			}
			return t;
		};
		expect(lap(0.95)).toBeLessThan(lap(0.85));
	});

	it('holds back behind a slower bike', () => {
		const r: Rider = {
			progress: 0,
			lateral: 0,
			speed: 30,
			lean: 0,
			y: 0,
			vy: 0,
			air: false,
			airtime: 0,
			skill: 0.9,
			lane: 0
		};
		for (let i = 0; i < 120; i++) stepRider(r, track, 1 / 60, 10);
		expect(r.speed).toBeLessThan(11);
	});
});

describe('pace', () => {
	it('eases riders off ahead of the player and pushes ones far behind', () => {
		expect(pace(60)).toBeLessThan(pace(20));
		expect(pace(20)).toBeLessThan(pace(0));
		expect(pace(0)).toBe(1);
		expect(pace(-100)).toBeGreaterThan(1);
	});
});
