// The circuit's scenery: grass, road with kerbs on the bends, the start line,
// trees, grandstands and distant hills.
import * as THREE from 'three';
import { pointAt, type Track } from './track.ts';

export const SKY = 0x9fd3ff;

export function buildWorld(scene: THREE.Scene, track: Track) {
	scene.background = new THREE.Color(SKY);
	scene.fog = new THREE.Fog(SKY, 200, 950);

	const ground = new THREE.Mesh(
		new THREE.PlaneGeometry(2400, 2400),
		new THREE.MeshLambertMaterial({ color: 0x5f9e3a })
	);
	ground.rotation.x = -Math.PI / 2;
	ground.position.set(240, 0, 0);
	ground.receiveShadow = true;
	scene.add(ground);

	scene.add(road(track));
	scene.add(kerbs(track));
	scene.add(startLine(track));
	scene.add(trees(track));
	scene.add(stands(track));
	scene.add(hills());
}

/** A strip along the track between two lateral offsets, one quad per sample. */
function strip(
	track: Track,
	from: number,
	to: number,
	y: number,
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
		// Two triangles, facing up.
		for (const p of [a, c1, b, b, c1, d]) {
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
	line.position.set(p.x, 0.035, p.z);
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

function trees(track: Track) {
	const rand = random(7);
	const spots: { x: number; z: number; scale: number }[] = [];
	while (spots.length < 260) {
		const x = -250 + rand() * 1000;
		const z = -560 + rand() * 1120;
		if (clearOfTrack(track, x, z, 18)) spots.push({ x, z, scale: 0.7 + rand() * 0.8 });
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
		crowns.setMatrixAt(i, m.compose(new THREE.Vector3(t.x, 5.5 * t.scale, t.z), q, s));
		trunks.setMatrixAt(i, m.compose(new THREE.Vector3(t.x, 1 * t.scale, t.z), q, s));
	});
	crowns.castShadow = true;
	const group = new THREE.Group();
	group.add(crowns, trunks);
	return group;
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
		stand.position.set(p.x, 0, p.z);
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
		const r = 720 + rand() * 120;
		const hill = new THREE.Mesh(
			new THREE.ConeGeometry(120 + rand() * 120, 60 + rand() * 90, 6),
			mat
		);
		hill.position.set(240 + Math.cos(a) * r, 20, Math.sin(a) * r);
		group.add(hill);
	}
	return group;
}
