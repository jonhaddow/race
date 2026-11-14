// Low-poly bikes and riders built from primitives: no model files to download.
import * as THREE from 'three';

export interface BikeModel {
	root: THREE.Group;
	/** Rolls about the tyres' contact line. */
	lean: THREE.Group;
	wheels: THREE.Mesh[];
}

const tyre = new THREE.TorusGeometry(0.31, 0.11, 8, 18);
const hub = new THREE.CylinderGeometry(0.12, 0.12, 0.12, 8);
const box = new THREE.BoxGeometry(1, 1, 1);
const helmetGeo = new THREE.SphereGeometry(0.17, 12, 8);
const black = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
const grey = new THREE.MeshLambertMaterial({ color: 0x8a8f96 });
const leathers = new THREE.MeshLambertMaterial({ color: 0x23262b });
const visor = new THREE.MeshLambertMaterial({ color: 0x0b0d10 });

function part(
	geo: THREE.BufferGeometry,
	mat: THREE.Material,
	pos: number[],
	size?: number[],
	rotX = 0
) {
	const m = new THREE.Mesh(geo, mat);
	m.position.set(pos[0], pos[1], pos[2]);
	if (size) m.scale.set(size[0], size[1], size[2]);
	m.rotation.x = rotX;
	m.castShadow = true;
	return m;
}

export function makeBike(color: number, number: number): BikeModel {
	const paint = new THREE.MeshLambertMaterial({ color });
	const root = new THREE.Group();
	const lean = new THREE.Group();
	root.add(lean);

	const wheels: THREE.Mesh[] = [];
	for (const z of [0.72, -0.68]) {
		const w = part(tyre, black, [0, 0.42, z]);
		w.rotation.y = Math.PI / 2;
		w.add(part(hub, grey, [0, 0, 0], undefined, Math.PI / 2));
		wheels.push(w);
		lean.add(w);
	}
	// Frame, tank, fairing, tail and seat.
	lean.add(part(box, grey, [0, 0.6, 0], [0.22, 0.22, 1.1]));
	lean.add(part(box, paint, [0, 0.95, 0.25], [0.42, 0.32, 0.7]));
	lean.add(part(box, paint, [0, 0.82, 0.72], [0.46, 0.46, 0.34], -0.5));
	lean.add(part(box, paint, [0, 0.92, -0.55], [0.32, 0.18, 0.55], 0.25));
	lean.add(part(box, black, [0, 0.92, -0.2], [0.3, 0.08, 0.35]));
	lean.add(part(box, visor, [0, 1.07, 0.82], [0.36, 0.14, 0.12], -0.9));

	// The rider, tucked in.
	lean.add(part(box, leathers, [0, 1.2, -0.12], [0.4, 0.28, 0.62], 0.55));
	lean.add(part(box, paint, [0, 1.25, -0.08], [0.42, 0.12, 0.3], 0.55));
	const helmet = part(helmetGeo, paint, [0, 1.42, 0.22]);
	helmet.add(part(box, visor, [0, 0.02, 0.12], [0.26, 0.09, 0.1]));
	lean.add(helmet);
	for (const x of [-0.24, 0.24]) {
		lean.add(part(box, leathers, [x, 1.13, 0.35], [0.1, 0.1, 0.5], 0.5));
		lean.add(part(box, leathers, [x, 0.78, -0.18], [0.12, 0.12, 0.48], -0.9));
	}
	// Race number on the tail.
	const plate = new THREE.Mesh(
		new THREE.PlaneGeometry(0.3, 0.3),
		new THREE.MeshBasicMaterial({ map: numberTexture(number) })
	);
	plate.position.set(0, 0.98, -0.83);
	plate.rotation.y = Math.PI;
	lean.add(plate);
	return { root, lean, wheels };
}

function numberTexture(n: number) {
	const c = document.createElement('canvas');
	c.width = c.height = 64;
	const g = c.getContext('2d')!;
	g.fillStyle = '#fff';
	g.fillRect(0, 0, 64, 64);
	g.fillStyle = '#000';
	g.font = 'bold 44px sans-serif';
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	g.fillText(String(n), 32, 35);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
}
