import { describe, expect, it } from 'vitest';
import { roll, steerFromRoll, upFromOrientation } from './tilt.ts';

const g = 9.81;
const deg = (d: number) => (d * Math.PI) / 180;

describe('roll', () => {
	// Gravity as reported (pointing up) with the phone upright and its right edge, as
	// shown on screen, tipped down by 20°.
	const down20 = { across: -g * Math.sin(deg(20)), up: g * Math.cos(deg(20)) };

	it('portrait: right edge down is positive', () => {
		expect(roll(down20.across, down20.up, 0, 0)).toBeCloseTo(deg(20));
	});

	it('landscape (90, top of the phone on the left): screen right is the phone bottom', () => {
		// Screen-right is device -y, screen-up is device +x.
		expect(roll(down20.up, -down20.across, 0, 90)).toBeCloseTo(deg(20));
	});

	it('landscape (270): screen right is the phone top', () => {
		expect(roll(-down20.up, down20.across, 0, 270)).toBeCloseTo(deg(20));
	});

	it('ignores how far back the phone is tipped', () => {
		const back = Math.cos(deg(50));
		const r = roll(down20.up * back, -down20.across, g * Math.sin(deg(50)), 90);
		expect(r).toBeGreaterThan(deg(17));
	});
});

describe('steerFromRoll', () => {
	it('is centred near the starting tilt and saturates at full lock', () => {
		expect(steerFromRoll(deg(31), deg(30))).toBe(0);
		expect(steerFromRoll(deg(40), deg(30))).toBeGreaterThan(0.3);
		expect(steerFromRoll(deg(80), deg(30))).toBe(1);
		expect(steerFromRoll(deg(-10), deg(30))).toBe(-1);
	});
});

describe('upFromOrientation', () => {
	it('is out of the screen lying flat', () => {
		const [x, y, z] = upFromOrientation(0, 0);
		expect(x).toBeCloseTo(0);
		expect(y).toBeCloseTo(0);
		expect(z).toBeCloseTo(1);
	});

	it('points to the left edge with the right edge tipped down (gamma +)', () => {
		expect(roll(...upFromOrientation(0, 30), 0)).toBeGreaterThan(0);
	});

	it('landscape (90), held tipped back: tipping the screen-right edge (the phone bottom) down steers right', () => {
		// Tipped back: the phone's right edge (screen top) raised, gamma negative.
		// Phone bottom down is its top raised: beta positive.
		const level = roll(...upFromOrientation(0, -50), 90);
		const turned = roll(...upFromOrientation(15, -50), 90);
		expect(steerFromRoll(turned, level)).toBeGreaterThan(0.3);
	});
});
