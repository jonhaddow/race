// The ground's height anywhere: it follows the road's hills near the track and
// rolls gently further out. Pure, so the scenery and tests share it.
import type { Track } from './track.ts';

export interface Terrain {
	height(x: number, z: number): number;
}

const smoothstep = (a: number, b: number, x: number) => {
	const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};

/** Gentle hills away from the track. */
function rolling(x: number, z: number) {
	return 4 + 4 * Math.sin(x / 70) * Math.cos(z / 90) + 3 * Math.sin((x + z) / 45);
}

export function terrain(track: Track): Terrain {
	// Every third sample is plenty for blending.
	const pts = track.points.filter((_, i) => i % 3 === 0);
	const half = track.width / 2;
	return {
		height(x, z) {
			let sum = 0;
			let weights = 0;
			let nearest = Infinity;
			for (const p of pts) {
				const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
				nearest = Math.min(nearest, d2);
				const w = 1 / (d2 * d2 + 1);
				sum += w * p.y;
				weights += w;
			}
			const d = Math.sqrt(nearest);
			const road = sum / weights;
			// Flat alongside the road (the pavement and the buildings' fronts), rolling further out.
			const out = smoothstep(half + 12, half + 80, d);
			// Just under the road, so it never pokes through; level with it beyond,
			// where bikes on the pavement ride at the road's height.
			const under = 0.35 * (1 - smoothstep(half + 1.2, half + 2.5, d));
			return road * (1 - out) + rolling(x, z) * out - under;
		}
	};
}
