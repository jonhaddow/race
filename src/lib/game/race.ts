// Lap counting and standings. Each racer has an unwrapped `progress`: metres
// travelled along the track since the start line (negative on the grid).
import type { Track } from './track.ts';

export const LAPS = 3;

/** Adds the change from `prevS` to `s` (both in [0, length)) to progress, across the line too. */
export function advance(track: Track, progress: number, prevS: number, s: number) {
	let d = s - prevS;
	if (d > track.length / 2) d -= track.length;
	if (d < -track.length / 2) d += track.length;
	return progress + d;
}

/** Laps completed, 0 until the first time over the line after the start. */
export function lapsDone(track: Track, progress: number) {
	return Math.max(0, Math.floor(progress / track.length));
}

export interface Standing {
	id: number;
	progress: number;
	/** Race time when they finished, if they have. */
	finishedAt?: number;
}

/** Finishers first, in order of finishing, then everyone else by distance. */
export function order(racers: Standing[]) {
	return [...racers].sort((a, b) => {
		if (a.finishedAt !== undefined || b.finishedAt !== undefined)
			return (a.finishedAt ?? Infinity) - (b.finishedAt ?? Infinity);
		return b.progress - a.progress;
	});
}

export function formatTime(seconds: number) {
	const m = Math.floor(seconds / 60);
	const s = seconds - m * 60;
	return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}
