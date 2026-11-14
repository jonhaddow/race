// The player's bike: arcade physics, tuned for fun over realism. Grip is high,
// and steering harder than the grip allows scrubs speed off by itself, so corners
// work with the gas held. Grass slows it down, but not much.

export interface Bike extends Body {
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

export const MAX_SPEED = 46; // ~165 km/h
export const GRIP = 24; // lateral m/s² the tyres hold on the road
const GRASS_GRIP = 16;
const GRASS_MAX = 24;
const ACCEL = 13;
const BRAKE = 26;
const MAX_YAW = 2;
/** How hard asking for more turn than the grip gives slows the bike, m/s². */
const SCRUB = 20;
/** Share of steering left in the air. */
const AIR_STEER = 0.4;

export function stepBike(bike: Bike, c: Controls, surface: Surface, dt: number) {
	let v = bike.speed;
	if (!bike.air) {
		v += ACCEL * c.throttle * Math.max(0, 1 - (v / MAX_SPEED) ** 2) * dt;
		v -= BRAKE * c.brake * dt;
		if (!c.throttle) v -= (0.5 + 0.0004 * v * v) * dt;
		if (surface === 'grass' && v > GRASS_MAX) v -= 14 * dt;
	}

	const grip = surface === 'road' ? GRIP : GRASS_GRIP;
	const want = Math.abs(c.steer) * MAX_YAW;
	const have = Math.min(MAX_YAW, grip / Math.max(v, 1));
	if (!bike.air && want > have) v -= SCRUB * ((want - have) / want) * dt;
	v = Math.max(0, v);

	const yaw = c.steer * have * Math.min(1, v / 3) * (bike.air ? AIR_STEER : 1);
	bike.heading -= yaw * dt;
	bike.speed = v;
	bike.x += Math.sin(bike.heading) * v * dt;
	bike.z += Math.cos(bike.heading) * v * dt;
	bike.lean = easeLean(bike.lean, bike.air ? 0 : v * yaw, dt);
}

/** Moves the lean towards what a lateral acceleration of `lateral` (m/s², + right) needs. */
export function easeLean(lean: number, lateral: number, dt: number) {
	const target = Math.max(-0.9, Math.min(0.9, Math.atan(lateral / 9.81)));
	return lean + (target - lean) * Math.min(1, dt * 8);
}

/** Up and down: riding over hills and flying off ramps. */
export interface Body {
	y: number;
	vy: number;
	air: boolean;
	/** Seconds in the air on the current (or last) jump. */
	airtime: number;
}

/** Floaty on purpose: about 1.2× Earth's, so jumps hang. */
export const GRAVITY = 12;
const STICK = 4;

/**
 * Follows the ground from `from` to `to` (heights under the bike before and after
 * this step), taking off where it falls away much faster than gravity could pull
 * the bike down: over the lip of a ramp.
 * Returns true on the step it lands.
 */
export function stepBody(b: Body, from: number, to: number, dt: number) {
	if (!b.air) {
		const groundVy = (to - from) / dt;
		// Sticky: it takes a sudden drop (a ramp's lip) to leave the ground, not a
		// hill's crest, which would throw riders off mid-corner.
		if (groundVy >= b.vy - STICK * GRAVITY * dt) {
			b.y = to;
			b.vy = groundVy;
			return false;
		}
		b.air = true;
		b.airtime = 0;
	}
	b.vy -= GRAVITY * dt;
	b.y += b.vy * dt;
	b.airtime += dt;
	if (b.y > to) return false;
	b.y = to;
	b.vy = 0;
	b.air = false;
	return true;
}
