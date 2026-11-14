// The circuit's scenery: grass, road with kerbs on the bends, the start line,
// trees, grandstands and distant hills.
import * as THREE from 'three';
import { terrain, type Terrain } from './terrain.ts';
import { pointAt, roadHeight, type Ramp, type Track } from './track.ts';

export const SKY = 0x9fd3ff;
const GRASS = 0x5f9e3a;
/** The shaped ground covers this box; trees stay inside it. */
const AREA = { x0: -400, x1: 900, z0: -720, z1: 720 };

export function buildWorld(scene: THREE.Scene, track: Track) {
	scene.background = new THREE.Color(SKY);
	scene.fog = new THREE.Fog(SKY, 200, 950);

	const land = terrain(track);
	scene.add(ground(land));
	// Beyond the shaped ground, out to the horizon.
	const far = new THREE.Mesh(
		new THREE.PlaneGeometry(5000, 5000),
		new THREE.MeshLambertMaterial({ color: GRASS })
	);
	far.rotation.x = -Math.PI / 2;
	far.position.set(240, -1, 0);
	scene.add(far);

	scene.add(road(track));
	scene.add(kerbs(track));
	scene.add(startLine(track));
	for (const r of track.ramps) scene.add(ramp(track, r));
	scene.add(trees(track, land));
	scene.add(stands(track, land));
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

function kerbs(track: Track) {
	const red = new THREE.Color(0xd8262e);
	const white = new THREE.Color(0xffffff);
	const w = track.width / 2;
	const onBend = (i: number) => Math.abs(track.points[i].curvature) > 1 / 140;
	const color = (i: number) => (onBend(i) ? (Math.floor(i / 2) % 2 ? red : white) : null);
	const group = new THREE.Group();
	group.add(strip(track, -w - 1.2, -w, 0.025, color));
	group.add(strip(track, w, w + 1.2, 0.025, color));
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

function clearOfTrack(track: Track, x: number, z: number, margin: number) {
	const min = (track.width / 2 + margin) ** 2;
	for (let i = 0; i < track.points.length; i += 2) {
		const p = track.points[i];
		if ((p.x - x) ** 2 + (p.z - z) ** 2 < min) return false;
	}
	return true;
}

function trees(track: Track, land: Terrain) {
	const rand = random(7);
	const spots: { x: number; z: number; y: number; scale: number }[] = [];
	while (spots.length < 320) {
		const x = AREA.x0 + 60 + rand() * (AREA.x1 - AREA.x0 - 120);
		const z = AREA.z0 + 60 + rand() * (AREA.z1 - AREA.z0 - 120);
		if (clearOfTrack(track, x, z, 18))
			spots.push({ x, z, y: land.height(x, z), scale: 0.7 + rand() * 0.8 });
	}
	const crowns = new THREE.InstancedMesh(
		new THREE.ConeGeometry(2.6, 7, 7),
		new THREE.MeshLambertMaterial({ color: 0x2f6b2a }),
		spots.length
	);
	const trunks = new THREE.InstancedMesh(
		new THREE.CylinderGeometry(0.35, 0.45, 2, 6),
		new THREE.MeshLambertMaterial({ color: 0x6b4a2b }),
		spots.length
	);
	const m = new THREE.Matrix4();
	spots.forEach((t, i) => {
		const s = new THREE.Vector3(t.scale, t.scale, t.scale);
		const q = new THREE.Quaternion();
		crowns.setMatrixAt(i, m.compose(new THREE.Vector3(t.x, t.y + 5.5 * t.scale, t.z), q, s));
		trunks.setMatrixAt(i, m.compose(new THREE.Vector3(t.x, t.y + 1 * t.scale, t.z), q, s));
	});
	crowns.castShadow = true;
	const group = new THREE.Group();
	group.add(crowns, trunks);
	return group;
}

function stands(track: Track, land: Terrain) {
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
			-track.width / 2 - 14
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
		stand.position.set(p.x, land.height(p.x, p.z), p.z);
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
	const low = new THREE.Color(0x5a9a36);
	const high = new THREE.Color(0x86bd4f);
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
