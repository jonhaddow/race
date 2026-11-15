// The circuit's scenery: a street circuit through a city. The road has a pavement
// each side ending in a barrier (the wall bikes glance off, see game.ts), with
// buildings behind, the start line, grandstands and distant hills.
import * as THREE from 'three';
import { terrain, type Terrain } from './terrain.ts';
import { pointAt, roadHeight, type Ramp, type Track } from './track.ts';

export const SKY = 0x9fd3ff;
/** Metres from the road's edge to the wall. */
export const PAVEMENT = 3;
const CONCRETE = 0x8d9096;
/** The shaped ground covers this box; buildings stay inside it. */
const AREA = { x0: -400, x1: 900, z0: -720, z1: 720 };

export function buildWorld(scene: THREE.Scene, track: Track) {
	scene.background = new THREE.Color(SKY);
	scene.fog = new THREE.Fog(SKY, 200, 950);

	const land = terrain(track);
	scene.add(ground(land));
	// Beyond the shaped ground, out to the horizon.
	const far = new THREE.Mesh(
		new THREE.PlaneGeometry(5000, 5000),
		new THREE.MeshLambertMaterial({ color: CONCRETE })
	);
	far.rotation.x = -Math.PI / 2;
	far.position.set(240, -1, 0);
	scene.add(far);

	scene.add(road(track));
	scene.add(pavements(track));
	scene.add(barriers(track));
	scene.add(startLine(track));
	for (const r of track.ramps) scene.add(ramp(track, r));
	scene.add(buildings(track, land));
	scene.add(stands(track));
	scene.add(hills());
}

/** A strip along the track between two lateral offsets, one quad per sample, `lift` above the road. */
function strip(
	track: Track,
	from: number,
	to: number,
	lift: number,
	color: (i: number) => THREE.Color | null
) {
	const pos: number[] = [];
	const col: number[] = [];
	const n = track.points.length;
	for (let i = 0; i < n; i++) {
		const c = color(i);
		if (!c) continue;
		const s0 = i * track.ds;
		const s1 = s0 + track.ds;
		const a = pointAt(track, s0, from);
		const b = pointAt(track, s0, to);
		const c1 = pointAt(track, s1, from);
		const d = pointAt(track, s1, to);
		const y0 = roadHeight(track, s0) + lift;
		const y1 = roadHeight(track, s1) + lift;
		// Two triangles, facing up.
		for (const [p, y] of [
			[a, y0],
			[c1, y1],
			[b, y0],
			[b, y0],
			[c1, y1],
			[d, y1]
		] as const) {
			pos.push(p.x, y, p.z);
			col.push(c.r, c.g, c.b);
		}
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
	geo.computeVertexNormals();
	const mesh = new THREE.Mesh(
		geo,
		new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
	);
	mesh.receiveShadow = true;
	return mesh;
}

function road(track: Track) {
	const w = track.width / 2;
	const tarmac = new THREE.Color(0x4a4d52);
	const group = new THREE.Group();
	group.add(strip(track, -w, w, 0.02, () => tarmac));
	// White edge lines and a dashed centre line.
	const white = new THREE.Color(0xf2f2f2);
	group.add(strip(track, -w + 0.3, -w + 0.5, 0.03, () => white));
	group.add(strip(track, w - 0.5, w - 0.3, 0.03, () => white));
	group.add(strip(track, -0.1, 0.1, 0.03, (i) => (i % 6 < 3 ? white : null)));
	return group;
}

function startLine(track: Track) {
	const c = document.createElement('canvas');
	c.width = 128;
	c.height = 16;
	const g = c.getContext('2d')!;
	for (let x = 0; x < 16; x++)
		for (let y = 0; y < 2; y++) {
			g.fillStyle = (x + y) % 2 ? '#111' : '#fff';
			g.fillRect(x * 8, y * 8, 8, 8);
		}
	const tex = new THREE.CanvasTexture(c);
	tex.magFilter = THREE.NearestFilter;
	tex.colorSpace = THREE.SRGBColorSpace;
	const line = new THREE.Mesh(
		new THREE.PlaneGeometry(track.width, 1.5),
		new THREE.MeshLambertMaterial({ map: tex })
	);
	const p = pointAt(track, 0);
	line.rotation.x = -Math.PI / 2;
	line.rotation.z = p.heading;
	line.position.set(p.x, roadHeight(track, 0) + 0.035, p.z);
	line.receiveShadow = true;

	// A gantry over the line.
	const group = new THREE.Group();
	group.add(line);
	const steel = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
	const gantry = new THREE.Group();
	for (const x of [-track.width / 2 - 1.5, track.width / 2 + 1.5]) {
		const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), steel);
		post.position.set(x, 3.5, 0);
		post.castShadow = true;
		gantry.add(post);
	}
	const beam = new THREE.Mesh(new THREE.BoxGeometry(track.width + 3.5, 1.4, 0.5), steel);
	beam.position.y = 7;
	gantry.add(beam);
	const banner = new THREE.Mesh(
		new THREE.BoxGeometry(track.width + 1, 0.9, 0.55),
		new THREE.MeshLambertMaterial({ color: 0xffd21f })
	);
	banner.position.y = 7;
	gantry.add(banner);
	gantry.position.set(p.x, 0, p.z);
	gantry.rotation.y = p.heading;
	group.add(gantry);
	return group;
}

/** A repeatable pseudo-random sequence, so the scenery is the same every time. */
function random(seed: number) {
	return () => {
		seed = (seed * 16807) % 2147483647;
		return seed / 2147483647;
	};
}

function pavements(track: Track) {
	const w = track.width / 2;
	const slab = new THREE.Color(0xb9bbbe);
	const kerb = new THREE.Color(0xe4e4e0);
	const group = new THREE.Group();
	for (const side of [-1, 1]) {
		const [a, b] = side < 0 ? [-w - PAVEMENT - 0.5, -w] : [w, w + PAVEMENT + 0.5];
		group.add(strip(track, a, b, 0.025, () => slab));
		group.add(strip(track, side * w, side * (w + 0.4), 0.03, () => kerb));
	}
	return group;
}

/** Red and white blocks just past the wall's line, with a little room for the bike. */
function barriers(track: Track) {
	const w = track.width / 2 + PAVEMENT + 0.5;
	const height = 1.1;
	const red = new THREE.Color(0xd8262e);
	const white = new THREE.Color(0xf2f2f2);
	const pos: number[] = [];
	const col: number[] = [];
	const n = track.points.length;
	for (const side of [-1, 1]) {
		for (let i = 0; i < n; i++) {
			const c = Math.floor(i / 2) % 2 ? red : white;
			const s0 = i * track.ds;
			const s1 = s0 + track.ds;
			const y0 = roadHeight(track, s0);
			const y1 = roadHeight(track, s1);
			const corner = (s: number, lateral: number, y: number) => {
				const p = pointAt(track, s, side * lateral);
				return [p.x, y, p.z];
			};
			// Inner face and top.
			const faces = [
				[
					corner(s0, w, y0 - 1),
					corner(s1, w, y1 - 1),
					corner(s0, w, y0 + height),
					corner(s1, w, y1 + height)
				],
				[
					corner(s0, w, y0 + height),
					corner(s1, w, y1 + height),
					corner(s0, w + 0.6, y0 + height),
					corner(s1, w + 0.6, y1 + height)
				]
			];
			for (const [a, b, cc, d] of faces)
				for (const v of [a, b, cc, cc, b, d]) {
					pos.push(...v);
					col.push(c.r, c.g, c.b);
				}
		}
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
	geo.computeVertexNormals();
	const mesh = new THREE.Mesh(
		geo,
		new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
	);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}

/** Whether every point is at least `margin` metres beyond the road's edge. */
function clearOfTrack(track: Track, points: { x: number; z: number }[], margin: number) {
	const min = (track.width / 2 + margin) ** 2;
	for (let i = 0; i < track.points.length; i += 2) {
		const p = track.points[i];
		for (const q of points) if ((p.x - q.x) ** 2 + (p.z - q.z) ** 2 < min) return false;
	}
	return true;
}

interface Block {
	x: number;
	z: number;
	/** Rotation about y: its depth runs along (sin, cos) of it. */
	angle: number;
	width: number;
	depth: number;
	height: number;
	color: THREE.Color;
}

const FACADES = [
	0xe6d3a8, 0xc8714f, 0x9fb7c9, 0xf1eee6, 0xe0b04a, 0x8c9aa6, 0xb95f5f, 0xa7c49a
].map((c) => new THREE.Color(c));

/** Corners of a block's footprint. */
function footprint(b: Block) {
	const fx = Math.sin(b.angle);
	const fz = Math.cos(b.angle);
	return [
		[-1, -1],
		[-1, 1],
		[1, 1],
		[1, -1]
	].map(([u, v]) => ({
		x: b.x + (u * b.width * fz) / 2 + (v * b.depth * fx) / 2,
		z: b.z - (u * b.width * fx) / 2 + (v * b.depth * fz) / 2
	}));
}

/**
 * The city: a row of buildings facing the street just behind each barrier, and
 * blocks on a grid filling the rest.
 */
function buildings(track: Track, land: Terrain) {
	const rand = random(7);
	const blocks: Block[] = [];
	const pick = () => FACADES[Math.floor(rand() * FACADES.length)];
	const front = track.width / 2 + PAVEMENT + 1.5;
	// The grandstands line the left of the start straight.
	const byStands = (s: number) => s > track.length - 90 || s < 70;

	for (const side of [-1, 1]) {
		let s = 0;
		while (s < track.length) {
			const width = 10 + rand() * 12;
			const depth = 10 + rand() * 10;
			const mid = s + width / 2;
			s += width + rand() * 2;
			if (side < 0 && byStands(mid)) continue;
			const p = pointAt(track, mid, side * (front + depth / 2));
			const b = {
				x: p.x,
				z: p.z,
				angle: p.heading + Math.PI / 2,
				width,
				depth,
				height: 8 + rand() * 22,
				color: pick()
			};
			if (clearOfTrack(track, [...footprint(b), b], PAVEMENT + 1)) blocks.push(b);
		}
	}

	const cell = 36;
	for (let x = AREA.x0 + cell; x < AREA.x1 - cell; x += cell)
		for (let z = AREA.z0 + cell; z < AREA.z1 - cell; z += cell) {
			const size = 14 + rand() * 14;
			const b = {
				x: x + (rand() - 0.5) * 4,
				z: z + (rand() - 0.5) * 4,
				angle: 0,
				width: size,
				depth: 14 + rand() * 14,
				// Taller towards the middle of town.
				height: 10 + rand() * (20 + 50 * Math.exp(-((x - 240) ** 2 + z ** 2) / 300 ** 2)),
				color: pick()
			};
			if (clearOfTrack(track, footprint(b), 26)) blocks.push(b);
		}

	// Walls (with windows) and roofs, each one mesh.
	const walls = { pos: [] as number[], col: [] as number[], uv: [] as number[] };
	const roofs = { pos: [] as number[], col: [] as number[], uv: [] as number[] };
	const roofTint = new THREE.Color(0x5b5f66);
	for (const b of blocks) {
		const corners = footprint(b);
		const heights = corners.map((c) => land.height(c.x, c.z));
		// Sunk into the slope, so no corner floats.
		const base = Math.min(...heights) - 2;
		const top = Math.max(...heights) + b.height;
		for (let k = 0; k < 4; k++) {
			const a = corners[k];
			const c = corners[(k + 1) % 4];
			const len = Math.hypot(c.x - a.x, c.z - a.z);
			const u = Math.round(len / 4);
			const v = (top - base) / 3.5;
			const quad = [
				[a.x, base, a.z, 0, 0],
				[c.x, base, c.z, u, 0],
				[a.x, top, a.z, 0, v],
				[a.x, top, a.z, 0, v],
				[c.x, base, c.z, u, 0],
				[c.x, top, c.z, u, v]
			];
			for (const [x, y, z, tu, tv] of quad) {
				walls.pos.push(x, y, z);
				walls.col.push(b.color.r, b.color.g, b.color.b);
				walls.uv.push(tu, tv);
			}
		}
		for (const i of [0, 1, 2, 0, 2, 3]) {
			roofs.pos.push(corners[i].x, top, corners[i].z);
			roofs.col.push(roofTint.r, roofTint.g, roofTint.b);
			roofs.uv.push(0, 0);
		}
	}
	const mesh = (m: typeof walls, map?: THREE.Texture) => {
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.Float32BufferAttribute(m.pos, 3));
		geo.setAttribute('color', new THREE.Float32BufferAttribute(m.col, 3));
		geo.setAttribute('uv', new THREE.Float32BufferAttribute(m.uv, 2));
		geo.computeVertexNormals();
		const out = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, map }));
		out.castShadow = true;
		return out;
	};
	const group = new THREE.Group();
	group.add(mesh(walls, windows()), mesh(roofs));
	return group;
}

/** One 4 m by 3.5 m bay of a facade: white wall (tinted per building) round a window. */
function windows() {
	const c = document.createElement('canvas');
	c.width = c.height = 64;
	const g = c.getContext('2d')!;
	g.fillStyle = '#fff';
	g.fillRect(0, 0, 64, 64);
	g.fillStyle = '#3d5a7a';
	g.fillRect(14, 14, 36, 34);
	g.fillStyle = '#7fa6c9';
	g.fillRect(14, 14, 36, 8);
	const tex = new THREE.CanvasTexture(c);
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
	tex.colorSpace = THREE.SRGBColorSpace;
	return tex;
}

function stands(track: Track) {
	const group = new THREE.Group();
	const seats = new THREE.MeshLambertMaterial({ color: 0xc9ccd1 });
	const roof = new THREE.MeshLambertMaterial({ color: 0xffd21f });
	const crowd = [0xd8262e, 0x2f6fd6, 0xffffff, 0xffd21f].map(
		(c) => new THREE.MeshLambertMaterial({ color: c })
	);
	const rand = random(3);
	for (const s of [-60, -10, 40]) {
		const p = pointAt(
			track,
			((s % track.length) + track.length) % track.length,
			-track.width / 2 - PAVEMENT - 2
		);
		const stand = new THREE.Group();
		for (let row = 0; row < 4; row++) {
			const step = new THREE.Mesh(new THREE.BoxGeometry(40, 1, 2), seats);
			step.position.set(0, 0.5 + row, -row * 2);
			stand.add(step);
			for (let k = 0; k < 24; k++) {
				const fan = new THREE.Mesh(
					new THREE.BoxGeometry(0.6, 0.9, 0.5),
					crowd[Math.floor(rand() * crowd.length)]
				);
				fan.position.set(-19 + k * 1.6 + rand() * 0.6, 1.45 + row, -row * 2);
				stand.add(fan);
			}
		}
		const top = new THREE.Mesh(new THREE.BoxGeometry(42, 0.4, 10), roof);
		top.position.set(0, 8, -3);
		stand.add(top);
		stand.position.set(p.x, roadHeight(track, s), p.z);
		// Facing the track: its front (+z) towards the road on the left of travel.
		stand.rotation.y = p.heading - Math.PI / 2;
		group.add(stand);
	}
	return group;
}

function hills() {
	const group = new THREE.Group();
	const mat = new THREE.MeshLambertMaterial({ color: 0x7fae63, flatShading: true });
	const rand = random(11);
	for (let i = 0; i < 18; i++) {
		const a = (i / 18) * Math.PI * 2;
		const r = 900 + rand() * 150;
		const hill = new THREE.Mesh(
			new THREE.ConeGeometry(120 + rand() * 120, 60 + rand() * 90, 6),
			mat
		);
		hill.position.set(240 + Math.cos(a) * r, 25, Math.sin(a) * r);
		group.add(hill);
	}
	return group;
}

/** The shaped ground: a grid following the terrain, shaded a little by height. */
function ground(land: Terrain) {
	const step = 8;
	const nx = Math.round((AREA.x1 - AREA.x0) / step);
	const nz = Math.round((AREA.z1 - AREA.z0) / step);
	const geo = new THREE.PlaneGeometry(AREA.x1 - AREA.x0, AREA.z1 - AREA.z0, nx, nz);
	geo.rotateX(-Math.PI / 2);
	geo.translate((AREA.x0 + AREA.x1) / 2, 0, (AREA.z0 + AREA.z1) / 2);
	const pos = geo.attributes.position;
	const colors: number[] = [];
	const low = new THREE.Color(0x868a90);
	const high = new THREE.Color(0xa3a59f);
	const c = new THREE.Color();
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i);
		const z = pos.getZ(i);
		// The edges sink to meet the flat plane beyond.
		const edge = Math.min(x - AREA.x0, AREA.x1 - x, z - AREA.z0, AREA.z1 - z);
		const y = edge < step ? -1 : land.height(x, z);
		pos.setY(i, y);
		c.lerpColors(low, high, Math.max(0, Math.min(1, y / 18)));
		colors.push(c.r, c.g, c.b);
	}
	geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
	geo.computeVertexNormals();
	const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
	mesh.receiveShadow = true;
	return mesh;
}

/** A kicker: a yellow and black striped wedge across the road. */
function ramp(track: Track, r: Ramp) {
	const pos: number[] = [];
	const col: number[] = [];
	const yellow = new THREE.Color(0xffd21f);
	const black = new THREE.Color(0x1d1f23);
	const side = new THREE.Color(0xc9a514);
	const w = track.width / 2;
	type V = { x: number; y: number; z: number };
	const tri = (a: V, b: V, c: V, colour: THREE.Color) => {
		for (const p of [a, b, c]) {
			pos.push(p.x, p.y, p.z);
			col.push(colour.r, colour.g, colour.b);
		}
	};
	const quad = (a: V, b: V, c: V, d: V, colour: THREE.Color) => {
		tri(a, b, c, colour);
		tri(c, b, d, colour);
	};
	const at = (s: number, lateral: number, up: number): V => {
		const p = pointAt(track, s, lateral);
		return { x: p.x, y: roadHeight(track, s) + up, z: p.z };
	};
	const start = r.s - r.length;
	const steps = Math.round(r.length);
	for (let k = 0; k < steps; k++) {
		const s0 = start + (k * r.length) / steps;
		const s1 = start + ((k + 1) * r.length) / steps;
		const h0 = (r.height * (s0 - start)) / r.length + 0.04;
		const h1 = (r.height * (s1 - start)) / r.length + 0.04;
		quad(at(s0, -w, h0), at(s1, -w, h1), at(s0, w, h0), at(s1, w, h1), k % 4 < 2 ? yellow : black);
		quad(at(s0, -w, 0), at(s1, -w, 0), at(s0, -w, h0), at(s1, -w, h1), side);
		quad(at(s0, w, 0), at(s1, w, 0), at(s0, w, h0), at(s1, w, h1), side);
	}
	const top = r.height + 0.04;
	quad(at(r.s, -w, 0), at(r.s, w, 0), at(r.s, -w, top), at(r.s, w, top), black);
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
	geo.computeVertexNormals();
	const mesh = new THREE.Mesh(
		geo,
		new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
	);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}
