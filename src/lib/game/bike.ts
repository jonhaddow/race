// The player's bike: arcade physics in world space. Grip limits how tightly it can
// turn at speed, so corners need braking; grass slows it down.

export interface Bike {
	x: number;
	z: number;
	/** See track.ts: moves along (sin heading, cos heading). */
	heading: number;
	/** Metres per second, never negative. */
	speed: number;
	/** Radians, positive leaning right (the visual follows the turn). */
	lean: number;
}

export interface Controls {
	throttle: number;
	brake: number;
	/** -1 full left to 1 full right. */
	steer: number;
}

export type Surface = 'road' | 'grass';

export const MAX_SPEED = 58; // ~209 km/h
export const GRIP = 14; // lateral m/s² the tyres hold on the road
const GRASS_GRIP = 8;
const GRASS_MAX = 16;
const ACCEL = 12;
const BRAKE = 24;
const MAX_YAW = 1.8;

export function stepBike(bike: Bike, c: Controls, surface: Surface, dt: number) {
	const top = MAX_SPEED;
	let v = bike.speed;
	v += ACCEL * c.throttle * Math.max(0, 1 - (v / top) ** 2) * dt;
	v -= BRAKE * c.brake * dt;
	if (!c.throttle) v -= (0.5 + 0.0004 * v * v) * dt;
	if (surface === 'grass' && v > GRASS_MAX) v -= 18 * dt;
	v = Math.max(0, v);

	const grip = surface === 'road' ? GRIP : GRASS_GRIP;
	const yaw = c.steer * Math.min(MAX_YAW, grip / Math.max(v, 1)) * Math.min(1, v / 3);
	bike.heading -= yaw * dt;
	bike.speed = v;
	bike.x += Math.sin(bike.heading) * v * dt;
	bike.z += Math.cos(bike.heading) * v * dt;
	bike.lean = easeLean(bike.lean, v * yaw, dt);
}

/** Moves the lean towards what a lateral acceleration of `lateral` (m/s², + right) needs. */
export function easeLean(lean: number, lateral: number, dt: number) {
	const target = Math.max(-0.9, Math.min(0.9, Math.atan(lateral / 9.81)));
	return lean + (target - lean) * Math.min(1, dt * 8);
}
