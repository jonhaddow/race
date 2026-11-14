// The circuit as evenly spaced samples along a closed centripetal Catmull-Rom curve
// through a few control points. Everything on the track (bikes, the AI's line, lap
// counting) works in track space: distance along it (s) and offset across it.
// Heading: travelling at heading h moves along (sin h, cos h) in (x, z), so a model
// facing +z with rotation.y = h points that way. With y up, right of a tangent
// (tx, tz) is (-tz, tx); lateral offsets are positive to the right.

export interface TrackPoint {
	x: number;
	z: number;
	/** Unit tangent. */
	tx: number;
	tz: number;
	/** Signed curvature (1/radius), positive turning left, smoothed over a few samples. */
	curvature: number;
}

export interface Track {
	points: TrackPoint[];
	/** Spacing between samples, in metres. */
	ds: number;
	length: number;
	/** Road width in metres. */
	width: number;
}

type P = [number, number];

/** Point on the centripetal Catmull-Rom segment p1→p2 at t in [0, 1]. */
function catmullRom(p0: P, p1: P, p2: P, p3: P, t: number): P {
	const knot = (a: P, b: P) => Math.max(Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])), 1e-4);
	const t1 = knot(p0, p1);
	const t2 = t1 + knot(p1, p2);
	const t3 = t2 + knot(p2, p3);
	const u = t1 + (t2 - t1) * t;
	const lerp = (a: P, b: P, ta: number, tb: number): P => {
		const w = (u - ta) / (tb - ta);
		return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
	};
	const a1 = lerp(p0, p1, 0, t1);
	const a2 = lerp(p1, p2, t1, t2);
	const a3 = lerp(p2, p3, t2, t3);
	const b1 = lerp(a1, a2, 0, t2);
	const b2 = lerp(a2, a3, t1, t3);
	return lerp(b1, b2, t1, t2);
}

export function buildTrack(control: P[], width: number, spacing = 2): Track {
	// A dense polyline first, then resampled at even spacing.
	const dense: P[] = [];
	const n = control.length;
	for (let i = 0; i < n; i++) {
		const p0 = control[(i - 1 + n) % n];
		const p1 = control[i];
		const p2 = control[(i + 1) % n];
		const p3 = control[(i + 2) % n];
		for (let k = 0; k < 60; k++) dense.push(catmullRom(p0, p1, p2, p3, k / 60));
	}
	const cumulative = [0];
	for (let i = 1; i <= dense.length; i++) {
		const a = dense[i - 1];
		const b = dense[i % dense.length];
		cumulative.push(cumulative[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
	}
	const length = cumulative[dense.length];
	const count = Math.round(length / spacing);
	const ds = length / count;

	const positions: P[] = [];
	let j = 0;
	for (let i = 0; i < count; i++) {
		const s = i * ds;
		while (cumulative[j + 1] < s) j++;
		const a = dense[j];
		const b = dense[(j + 1) % dense.length];
		const w = (s - cumulative[j]) / (cumulative[j + 1] - cumulative[j]);
		positions.push([a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w]);
	}

	const headings = positions.map((_, i) => {
		const a = positions[(i - 1 + count) % count];
		const b = positions[(i + 1) % count];
		return Math.atan2(b[0] - a[0], b[1] - a[1]);
	});
	const raw = headings.map((h, i) => wrapAngle(headings[(i + 1) % count] - h) / ds);
	const smooth = 4;
	const points = positions.map(([x, z], i) => {
		let sum = 0;
		for (let k = -smooth; k <= smooth; k++) sum += raw[(i + k + count) % count];
		return {
			x,
			z,
			tx: Math.sin(headings[i]),
			tz: Math.cos(headings[i]),
			curvature: sum / (2 * smooth + 1)
		};
	});
	return { points, ds, length, width };
}

export function wrapAngle(a: number) {
	return Math.atan2(Math.sin(a), Math.cos(a));
}

/** s in [0, length). */
export function wrapS(track: Track, s: number) {
	return ((s % track.length) + track.length) % track.length;
}

export function sample(track: Track, s: number): TrackPoint {
	const pts = track.points;
	return pts[Math.floor(wrapS(track, s) / track.ds) % pts.length];
}

/** World position and heading at distance s along the track, lateral metres to the right. */
export function pointAt(track: Track, s: number, lateral = 0) {
	const pts = track.points;
	const f = wrapS(track, s) / track.ds;
	const i = Math.floor(f) % pts.length;
	const a = pts[i];
	const b = pts[(i + 1) % pts.length];
	const w = f - Math.floor(f);
	const tx = a.tx + (b.tx - a.tx) * w;
	const tz = a.tz + (b.tz - a.tz) * w;
	const len = Math.hypot(tx, tz);
	const ux = tx / len;
	const uz = tz / len;
	return {
		x: a.x + (b.x - a.x) * w - uz * lateral,
		z: a.z + (b.z - a.z) * w + ux * lateral,
		heading: Math.atan2(ux, uz)
	};
}

export interface Located {
	/** Nearest sample, to pass back as the next hint. */
	index: number;
	s: number;
	/** Metres right of the centre line. */
	lateral: number;
}

/**
 * Where a world position is in track space. With a hint (the last index), only
 * nearby samples are searched, which also stops a bike jumping to a part of
 * the circuit that passes close by.
 */
export function locate(track: Track, x: number, z: number, hint?: number): Located {
	const pts = track.points;
	const n = pts.length;
	let best = 0;
	let bestD = Infinity;
	const from = hint === undefined ? 0 : hint - 25;
	const to = hint === undefined ? n - 1 : hint + 25;
	for (let k = from; k <= to; k++) {
		const i = ((k % n) + n) % n;
		const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2;
		if (d < bestD) {
			bestD = d;
			best = i;
		}
	}
	const p = pts[best];
	const dx = x - p.x;
	const dz = z - p.z;
	return {
		index: best,
		s: wrapS(track, best * track.ds + dx * p.tx + dz * p.tz),
		lateral: -dx * p.tz + dz * p.tx
	};
}

/** The circuit: about 2 km, with a long straight, fast sweepers and two hairpins. */
export const CIRCUIT: P[] = [
	[0, -120],
	[0, 100],
	[30, 220],
	[120, 262],
	[220, 225],
	[250, 135],
	[200, 60],
	[225, -20],
	[330, -40],
	[400, 30],
	[470, 0],
	[480, -120],
	[400, -230],
	[250, -255],
	[120, -310],
	[30, -290],
	[0, -225]
];

export const ROAD_WIDTH = 12;
