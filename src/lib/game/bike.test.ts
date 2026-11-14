import { describe, expect, it } from 'vitest';
import { MAX_SPEED, stepBike, type Bike, type Controls, type Surface } from './bike.ts';

const fresh = (): Bike => ({ x: 0, z: 0, heading: 0, speed: 0, lean: 0 });
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

	it('is slow on grass', () => {
		const bike = { ...fresh(), speed: 50 };
		ride(bike, { throttle: 1, brake: 0, steer: 0 }, 5, 'grass');
		expect(bike.speed).toBeLessThan(20);
	});
});
