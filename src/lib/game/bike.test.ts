import { describe, expect, it } from 'vitest';
import {
	MAX_SPEED,
	stepBike,
	stepBody,
	type Bike,
	type Body,
	type Controls,
	type Surface
} from './bike.ts';

const fresh = (): Bike => ({
	x: 0,
	z: 0,
	heading: 0,
	speed: 0,
	lean: 0,
	y: 0,
	vy: 0,
	air: false,
	airtime: 0
});
const ride = (bike: Bike, c: Controls, seconds: number, surface: Surface = 'road') => {
	for (let t = 0; t < seconds; t += 1 / 60) stepBike(bike, c, surface, 1 / 60);
};

describe('stepBike', () => {
	it('accelerates towards but not past top speed', () => {
		const bike = fresh();
		ride(bike, { throttle: 1, brake: 0, steer: 0 }, 3);
		expect(bike.speed).toBeGreaterThan(25);
		ride(bike, { throttle: 1, brake: 0, steer: 0 }, 60);
		expect(bike.speed).toBeLessThan(MAX_SPEED);
		expect(bike.speed).toBeGreaterThan(MAX_SPEED * 0.9);
		expect(bike.z).toBeGreaterThan(100);
		expect(bike.x).toBeCloseTo(0);
	});

	it('brakes to a stop and never reverses', () => {
		const bike = { ...fresh(), speed: 40 };
		ride(bike, { throttle: 0, brake: 1, steer: 0 }, 3);
		expect(bike.speed).toBe(0);
	});

	it('steering right turns right (towards -x when heading +z) and leans right', () => {
		const bike = { ...fresh(), speed: 20 };
		ride(bike, { throttle: 0.5, brake: 0, steer: 1 }, 0.5);
		expect(bike.x).toBeLessThan(0);
		expect(bike.lean).toBeGreaterThan(0.3);
	});

	it('turns less sharply at speed', () => {
		const slow = { ...fresh(), speed: 10 };
		const fast = { ...fresh(), speed: 50 };
		stepBike(slow, { throttle: 0, brake: 0, steer: 1 }, 'road', 0.1);
		stepBike(fast, { throttle: 0, brake: 0, steer: 1 }, 'road', 0.1);
		expect(Math.abs(fast.heading)).toBeLessThan(Math.abs(slow.heading));
	});

	it('is slower on grass', () => {
		const bike = { ...fresh(), speed: 45 };
		ride(bike, { throttle: 1, brake: 0, steer: 0 }, 5, 'grass');
		expect(bike.speed).toBeLessThan(26);
	});

	it('slows itself for a hairpin with the gas held, without braking', () => {
		const bike = { ...fresh(), speed: MAX_SPEED };
		ride(bike, { throttle: 1, brake: 0, steer: 1 }, 3);
		// A 30 m radius bend needs about 27 m/s at this grip.
		expect(bike.speed).toBeLessThan(28);
		expect(bike.speed).toBeGreaterThan(15);
	});
});

describe('stepBody', () => {
	const body = (): Body => ({ y: 0, vy: 0, air: false, airtime: 0 });

	it('stays on over a fast crest', () => {
		const b = body();
		// A crest of 60 m radius at 40 m/s: 27 m/s² down, more than gravity.
		const h = (t: number) => -((40 * t) ** 2) / 120;
		for (let i = 1; i <= 60; i++) stepBody(b, h((i - 1) / 60), h(i / 60), 1 / 60);
		expect(b.air).toBe(false);
		expect(b.y).toBeCloseTo(h(1));
	});

	it('only hops when ridden onto the side of a ramp', () => {
		const b = body();
		stepBody(b, 0, 2.2, 1 / 60);
		let top = b.y;
		for (let i = 0; i < 300; i++) {
			stepBody(b, 2.2, 2.2, 1 / 60);
			top = Math.max(top, b.y);
		}
		expect(top).toBeLessThan(7);
		expect(b.air).toBe(false);
	});

	it('flies off a ramp lip and lands about a second later', () => {
		const b = body();
		// Up a ramp at 6 m/s vertical, then the ground drops 2 m.
		for (let i = 1; i <= 20; i++) stepBody(b, (i - 1) * 0.1, i * 0.1, 1 / 60);
		stepBody(b, 2, 0, 1 / 60);
		expect(b.air).toBe(true);
		let landed = false;
		for (let i = 0; i < 300 && !landed; i++) landed = stepBody(b, 0, 0, 1 / 60);
		expect(landed).toBe(true);
		expect(b.airtime).toBeGreaterThan(0.9);
		expect(b.y).toBe(0);
	});
});
