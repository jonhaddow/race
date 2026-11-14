// Computer riders, in track space: they ride their lane, take the inside of
// corners and brake to the speed their grip allows for the tightest bend ahead,
// scaled by their skill.
import { GRIP, MAX_SPEED, easeLean, type Body } from './bike.ts';
import { sample, type Track } from './track.ts';

export interface Rider extends Body {
	/** Distance along the track since the start line, unwrapped (laps add up). */
	progress: number;
	lateral: number;
	speed: number;
	lean: number;
	/** Fraction of the ideal pace, e.g. 0.9. */
	skill: number;
	/** Preferred offset from the centre line on straights. */
	lane: number;
}

/** Fastest speed the bend `ahead` metres of track allows, at `skill`. */
export function cornerSpeed(track: Track, progress: number, ahead: number, skill: number) {
	let k = 0;
	for (let d = 0; d <= ahead; d += track.ds * 2) {
		k = Math.max(k, Math.abs(sample(track, progress + d).curvature));
	}
	return Math.min(MAX_SPEED * skill, Math.sqrt((GRIP * skill) / Math.max(k, 1e-6)));
}

/**
 * `blockedAt`: speed of a bike just ahead in the rider's lane, if any. `pace`
 * scales their skill for this step (the game eases riders off when far ahead).
 * Track space only: the game moves them up and down.
 */
export function stepRider(rider: Rider, track: Track, dt: number, blockedAt?: number, pace = 1) {
	const v = rider.speed;
	const skill = rider.skill * pace;
	// Far enough ahead to brake in time: v² / 2a, plus a margin.
	const ahead = (v * v) / (2 * 18) + 20;
	let target = cornerSpeed(track, rider.progress, ahead, skill);
	if (blockedAt !== undefined) target = Math.min(target, blockedAt);
	const next =
		v < target
			? Math.min(target, v + 12 * skill * (1 - (v / MAX_SPEED) ** 2) * dt)
			: Math.max(target, v - 20 * dt);
	rider.speed = Math.max(0, next);

	const k = sample(track, rider.progress + 15).curvature;
	const edge = track.width / 2 - 1.2;
	// Inside of the bend: left (negative lateral) when curvature is positive.
	const inside = Math.max(-1, Math.min(1, k * 60));
	const want = Math.max(
		-edge,
		Math.min(edge, rider.lane * (1 - Math.abs(inside)) - inside * edge * 0.7)
	);
	rider.lateral += (want - rider.lateral) * Math.min(1, dt * 0.8);
	rider.progress += rider.speed * dt;

	const here = sample(track, rider.progress).curvature;
	// Positive curvature turns left, so the bike leans left (negative).
	rider.lean = easeLean(rider.lean, -here * rider.speed * rider.speed, dt);
}

/**
 * How hard a rider pushes, given how far they lead the player (metres, negative
 * behind): riders far ahead ease off and ones far behind push, so the race stays close.
 */
export function pace(lead: number) {
	if (lead > 40) return 0.8;
	if (lead > 15) return 0.92;
	if (lead < -60) return 1.08;
	return 1;
}
