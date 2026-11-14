// Steering by tilting the phone like a steering wheel, from deviceorientation's
// beta and gamma (see CLAUDE.md for why not devicemotion). Works however far back
// the phone is tipped.

/**
 * The direction away from the ground in the phone's own axes (x right, y to its
 * top, z out of the screen), from deviceorientation's beta and gamma in degrees.
 */
export function upFromOrientation(beta: number, gamma: number): [number, number, number] {
	const b = (beta * Math.PI) / 180;
	const g = (gamma * Math.PI) / 180;
	return [-Math.sin(g) * Math.cos(b), Math.sin(b), Math.cos(g) * Math.cos(b)];
}

/** Tilt that gives full lock, in radians. */
const FULL_LOCK = (25 * Math.PI) / 180;
const DEAD_ZONE = (2 * Math.PI) / 180;

/**
 * The phone's roll from upright in the current screen orientation, in radians,
 * given the up vector in the phone's axes;
 * positive with its right-hand edge (as the screen is shown) tipped down.
 * `angle` is screen.orientation.angle: 0, 90, 180 or 270.
 */
export function roll(ax: number, ay: number, az: number, angle: number) {
	// Gravity along the screen's left-to-right axis.
	const a = ((angle % 360) + 360) % 360;
	const across = a === 90 ? -ay : a === 270 ? ay : a === 180 ? -ax : ax;
	const along = a === 90 || a === 270 ? ax : ay;
	// With the right edge down, "up" points towards the left edge: across < 0.
	return Math.atan2(-across, Math.hypot(along, az));
}

/** Steering from -1 (full left) to 1, relative to the roll held at the start. */
export function steerFromRoll(r: number, neutral: number) {
	const d = r - neutral;
	if (Math.abs(d) < DEAD_ZONE) return 0;
	const s = (d - Math.sign(d) * DEAD_ZONE) / (FULL_LOCK - DEAD_ZONE);
	return Math.max(-1, Math.min(1, s));
}
