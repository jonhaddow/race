// Turns keys, the on-screen pedals and tilt into Controls.
import type { Controls } from './bike.ts';
import { roll, steerFromRoll, upFromOrientation } from './tilt.ts';

export class Input {
	/** Set by the on-screen buttons. */
	touch = { throttle: false, brake: false, left: false, right: false };
	private keys = new Set<string>();
	private steer = 0;
	/** Latest roll from the motion sensor, if it has sent any. */
	private roll: number | undefined;
	private neutral = 0;
	private smoothedTilt = 0;

	get hasTilt() {
		return this.roll !== undefined;
	}

	private onKey = (e: KeyboardEvent) => {
		if (e.type === 'keydown') this.keys.add(e.code);
		else this.keys.delete(e.code);
		if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
	};

	private onOrientation = (e: DeviceOrientationEvent) => {
		if (e.beta == null || e.gamma == null) return;
		const [x, y, z] = upFromOrientation(e.beta, e.gamma);
		this.roll = roll(x, y, z, screenAngle());
	};

	attach() {
		addEventListener('keydown', this.onKey);
		addEventListener('keyup', this.onKey);
		addEventListener('deviceorientation', this.onOrientation);
		addEventListener('blur', this.release);
	}

	detach() {
		removeEventListener('keydown', this.onKey);
		removeEventListener('keyup', this.onKey);
		removeEventListener('deviceorientation', this.onOrientation);
		removeEventListener('blur', this.release);
	}

	private release = () => {
		this.keys.clear();
		this.touch = { throttle: false, brake: false, left: false, right: false };
	};

	/** Takes however the phone is held now as straight ahead. */
	calibrate() {
		if (this.roll !== undefined) this.neutral = this.roll;
	}

	read(dt: number): Controls {
		const k = (...codes: string[]) => codes.some((c) => this.keys.has(c));
		const throttle = k('ArrowUp', 'KeyW') || this.touch.throttle ? 1 : 0;
		const brake = k('ArrowDown', 'KeyS', 'Space') || this.touch.brake ? 1 : 0;
		const left = k('ArrowLeft', 'KeyA') || this.touch.left;
		const right = k('ArrowRight', 'KeyD') || this.touch.right;

		if (left || right || this.roll === undefined) {
			// Keys and buttons ease in, so a tap is a small correction.
			const want = (right ? 1 : 0) - (left ? 1 : 0);
			const rate = want === 0 ? 6 : 3.5;
			this.steer += Math.max(-rate * dt, Math.min(rate * dt, want - this.steer));
			return { throttle, brake, steer: this.steer };
		}
		const tilt = steerFromRoll(this.roll, this.neutral);
		this.smoothedTilt += (tilt - this.smoothedTilt) * Math.min(1, dt * 14);
		this.steer = this.smoothedTilt;
		return { throttle, brake, steer: this.steer };
	}
}

function screenAngle() {
	if (screen.orientation) return screen.orientation.angle;
	// Older iOS: window.orientation is -90 for what screen.orientation calls 270.
	const legacy = (window as { orientation?: number }).orientation ?? 0;
	return (legacy + 360) % 360;
}

/**
 * iOS asks before sharing motion data, and only from a tap. Elsewhere it's just on.
 * Resolves whether tilt may work.
 */
export async function askForMotion() {
	const Motion = globalThis.DeviceOrientationEvent as
		| (typeof DeviceOrientationEvent & {
				requestPermission?: () => Promise<'granted' | 'denied'>;
		  })
		| undefined;
	if (!Motion) return false;
	if (!Motion.requestPermission) return true;
	try {
		return (await Motion.requestPermission()) === 'granted';
	} catch {
		return false;
	}
}
