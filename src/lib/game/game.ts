// The race: three computer riders and the player over LAPS laps, drawn with three.js.
// The page shows `hud` and calls start/pause; everything else happens here.
import * as THREE from 'three';
import { pace, stepRider, type Rider } from './ai.ts';
import { glance, stepBike, stepBody, type Bike, type Body } from './bike.ts';
import { Input } from './input.ts';
import { makeBike, type BikeModel } from './models.ts';
import { LAPS, advance, lapsDone, order } from './race.ts';
import {
	CIRCUIT,
	RAMPS,
	ROAD_WIDTH,
	buildTrack,
	groundHeight,
	locate,
	pointAt,
	roadHeight,
	wrapAngle,
	type Track
} from './track.ts';
import { PAVEMENT, buildWorld } from './world.ts';

export type Phase = 'menu' | 'countdown' | 'racing' | 'finished';

export interface Hud {
	phase: Phase;
	/** Seconds left in the countdown. */
	countdown: number;
	lap: number;
	position: number;
	racers: number;
	speedKmh: number;
	raceTime: number;
	lapTime: number;
	lastLap?: number;
	bestLap?: number;
	/** Set when the player finishes. */
	result?: { position: number; time: number; bestLap: number; newRecord: boolean };
	paused: boolean;
	/** A cheer for a moment, e.g. after a big jump. */
	flash?: string;
}

const COLOURS = [0xffd21f, 0xd8262e, 0x2f6fd6, 0x2bb673];
const COUNTDOWN = 3;
const RECORD_KEY = 'race:best-lap';

interface Racer {
	id: number;
	model: BikeModel;
	progress: number;
	finishedAt?: number;
}

export class Game {
	readonly input = new Input();
	hud: Hud = {
		phase: 'menu',
		countdown: COUNTDOWN,
		lap: 1,
		position: 4,
		racers: 4,
		speedKmh: 0,
		raceTime: 0,
		lapTime: 0,
		paused: false
	};

	private renderer: THREE.WebGLRenderer;
	private scene = new THREE.Scene();
	private camera = new THREE.PerspectiveCamera(65, 1, 0.1, 1400);
	private sun = new THREE.DirectionalLight(0xffffff, 2.2);
	private track: Track = buildTrack(CIRCUIT, ROAD_WIDTH, RAMPS);

	private player!: Bike & Racer & { index: number; s: number; ground: number };
	private riders: (Rider & Racer)[] = [];
	private lapStart = 0;
	private lapsCounted = 0;
	private setRecord = false;
	private frame = 0;
	private last = 0;
	private clock = 0;
	private flashUntil = 0;
	private resize: ResizeObserver;

	constructor(private canvas: HTMLCanvasElement) {
		this.renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: devicePixelRatio < 2,
			powerPreference: 'high-performance'
		});
		this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFShadowMap;

		this.scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x6b6f76, 1.4));
		this.sun.position.set(60, 120, 40);
		this.sun.castShadow = true;
		this.sun.shadow.mapSize.set(1024, 1024);
		const sc = this.sun.shadow.camera;
		sc.left = sc.bottom = -30;
		sc.right = sc.top = 30;
		sc.far = 300;
		this.scene.add(this.sun, this.sun.target);
		buildWorld(this.scene, this.track);

		this.setUp();
		this.resize = new ResizeObserver(() => this.fit());
		this.resize.observe(canvas);
		this.fit();
		this.input.attach();
		this.last = performance.now();
		this.frame = requestAnimationFrame(this.tick);
	}

	/** Bikes on the grid, the player at the back. */
	private setUp() {
		for (const r of [...this.riders, this.player]) if (r) this.scene.remove(r.model.root);
		const grid = (slot: number) => ({ progress: -6 - slot * 6, lateral: slot % 2 ? -2.5 : 2.5 });
		const body = { y: 0, vy: 0, air: false, airtime: 0 };
		this.riders = [0.88, 0.83, 0.78].map((skill, i) => {
			const g = grid(i);
			const model = makeBike(COLOURS[i + 1], i + 2);
			this.scene.add(model.root);
			return { id: i + 1, model, ...g, ...body, speed: 0, lean: 0, skill, lane: g.lateral };
		});
		const g = grid(3);
		const p = pointAt(this.track, g.progress, g.lateral);
		const model = makeBike(COLOURS[0], 1);
		this.scene.add(model.root);
		const at = locate(this.track, p.x, p.z);
		this.player = {
			id: 0,
			model,
			x: p.x,
			z: p.z,
			heading: p.heading,
			speed: 0,
			lean: 0,
			...body,
			progress: g.progress,
			index: at.index,
			s: at.s,
			ground: 0
		};
		this.lapsCounted = 0;
		this.setRecord = false;
		this.lapStart = 0;
		this.clock = 0;
		Object.assign(this.hud, {
			countdown: COUNTDOWN,
			lap: 1,
			position: 4,
			speedKmh: 0,
			raceTime: 0,
			lapTime: 0,
			lastLap: undefined,
			result: undefined,
			flash: undefined,
			bestLap: bestLap()
		});
		this.place();
	}

	start() {
		this.setUp();
		this.hud.phase = 'countdown';
		this.hud.paused = false;
	}

	setPaused(paused: boolean) {
		this.hud.paused = paused;
		if (!paused) this.last = performance.now();
	}

	dispose() {
		cancelAnimationFrame(this.frame);
		this.resize.disconnect();
		this.input.detach();
		this.renderer.dispose();
	}

	private fit() {
		const w = this.canvas.clientWidth;
		const h = this.canvas.clientHeight;
		if (!w || !h) return;
		this.renderer.setSize(w, h, false);
		this.camera.aspect = w / h;
		// Portrait screens get a wider view, so the road ahead still fits.
		this.camera.fov = w > h ? 62 : 80;
		this.camera.updateProjectionMatrix();
	}

	private tick = (now: number) => {
		this.frame = requestAnimationFrame(this.tick);
		const dt = Math.min(0.05, (now - this.last) / 1000);
		this.last = now;
		if (!this.hud.paused) this.update(dt);
		this.renderer.render(this.scene, this.camera);
	};

	private update(dt: number) {
		const hud = this.hud;
		this.clock += dt;
		if (hud.phase === 'menu') {
			this.orbit();
			return;
		}
		if (hud.phase === 'countdown') {
			hud.countdown -= dt;
			// Whatever angle the phone's held at as the lights go out is straight ahead.
			this.input.calibrate();
			this.input.read(dt);
			if (hud.countdown <= 0) hud.phase = 'racing';
			this.place();
			this.chase(1);
			return;
		}

		hud.raceTime += dt;
		if (hud.flash && hud.raceTime > this.flashUntil) hud.flash = undefined;
		this.stepPlayer(dt);
		this.stepRiders(dt);

		const standings = order([this.player, ...this.riders]);
		const p = this.player;
		if (hud.phase === 'racing') {
			hud.position = standings.indexOf(p) + 1;
			hud.speedKmh = Math.round(p.speed * 3.6);
			hud.lapTime = hud.raceTime - this.lapStart;
		}
		this.place();
		this.chase(dt);
	}

	private stepPlayer(dt: number) {
		const p = this.player;
		const hud = this.hud;
		const before = locate(this.track, p.x, p.z, p.index);
		const c = hud.phase === 'racing' ? this.input.read(dt) : this.cruise(before.s);
		const from = this.groundAt(before.s, before.lateral);
		stepBike(p, c, dt);

		let at = locate(this.track, p.x, p.z, p.index);
		// The pavement ends in a wall, which turns the bike back onto the road.
		const limit = this.track.width / 2 + PAVEMENT;
		if (Math.abs(at.lateral) > limit) {
			const side = Math.sign(at.lateral);
			const back = pointAt(this.track, at.s, side * limit);
			p.x = back.x;
			p.z = back.z;
			glance(p, back.heading, side);
			at = locate(this.track, p.x, p.z, at.index);
		}

		// Bumping a computer rider pushes the player aside.
		for (const r of this.riders) {
			const rp = pointAt(this.track, r.progress, r.lateral);
			const dx = p.x - rp.x;
			const dz = p.z - rp.z;
			const d = Math.hypot(dx, dz);
			if (d < 1.1 && d > 0) {
				p.x += (dx / d) * (1.1 - d);
				p.z += (dz / d) * (1.1 - d);
				p.speed *= 1 - 1.5 * dt;
			}
		}

		p.ground = this.groundAt(at.s, at.lateral);
		const landed = stepBody(p, from, p.ground, dt);
		if (landed && p.airtime > 0.7) this.cheer(p.airtime > 1.2 ? 'Huge air!' : 'Big air!');

		p.progress = advance(this.track, p.progress, p.s, at.s);
		p.s = at.s;
		p.index = at.index;

		const done = lapsDone(this.track, p.progress);
		if (hud.phase === 'racing' && done > this.lapsCounted) {
			this.lapsCounted = done;
			const lap = hud.raceTime - this.lapStart;
			this.lapStart = hud.raceTime;
			hud.lastLap = lap;
			const best = bestLap();
			const record = best === undefined || lap < best;
			if (record) localStorage.setItem(RECORD_KEY, String(lap));
			this.setRecord ||= record;
			hud.bestLap = record ? lap : best;
			if (done >= LAPS) this.finish();
			else hud.lap = done + 1;
		}
	}

	/** Under a bike: the ramps only span the road. */
	private groundAt(s: number, lateral: number) {
		return Math.abs(lateral) <= this.track.width / 2 + 0.5
			? groundHeight(this.track, s)
			: roadHeight(this.track, s);
	}

	private cheer(text: string) {
		this.hud.flash = text;
		this.flashUntil = this.hud.raceTime + 1.4;
	}

	/** After the flag the bike rides itself round, back to the centre of the road. */
	private cruise(s: number) {
		const p = this.player;
		const ahead = pointAt(this.track, s + 8, 0);
		const want = Math.atan2(ahead.x - p.x, ahead.z - p.z);
		const steer = Math.max(-1, Math.min(1, -wrapAngle(want - p.heading) * 2.5));
		return {
			throttle: p.speed < 20 ? 0.6 : 0,
			brake: 0,
			steer
		};
	}

	private finish() {
		const p = this.player;
		const hud = this.hud;
		p.finishedAt = hud.raceTime;
		hud.position = order([p, ...this.riders]).indexOf(p) + 1;
		hud.phase = 'finished';
		hud.result = {
			position: hud.position,
			time: hud.raceTime,
			bestLap: hud.bestLap ?? hud.raceTime,
			newRecord: this.setRecord
		};
	}

	private stepRiders(dt: number) {
		const p = this.player;
		const playerAt = locate(this.track, p.x, p.z, p.index);
		for (const r of this.riders) {
			if (r.finishedAt !== undefined) {
				// Slow to a cruise after the flag.
				r.skill = Math.min(r.skill, 0.4);
			}
			// Hold back if the player is just ahead in this rider's path.
			const gap = p.progress - r.progress;
			const blocked = gap > 0 && gap < 5 && Math.abs(playerAt.lateral - r.lateral) < 1.3;
			const from = groundHeight(this.track, r.progress);
			stepRider(r, this.track, dt, blocked ? p.speed : undefined, pace(r.progress - p.progress));
			stepBody(r, from, groundHeight(this.track, r.progress), dt);
			if (r.finishedAt === undefined && r.progress >= LAPS * this.track.length)
				r.finishedAt = this.hud.raceTime;
		}
	}

	/** Moves the models to the bikes' positions. */
	private place() {
		const p = this.player;
		this.pose(p.model, p.x, p.z, p.heading, p);
		for (const r of this.riders) {
			const at = pointAt(this.track, r.progress, r.lateral);
			this.pose(r.model, at.x, at.z, at.heading, r);
		}
	}

	private pose(
		m: BikeModel,
		x: number,
		z: number,
		heading: number,
		{ y, vy, lean, speed }: Body & { lean: number; speed: number }
	) {
		m.root.position.set(x, y, z);
		// Heading, then pitch (nose up climbing or flying up), then the lean inside.
		m.root.rotation.order = 'YXZ';
		m.root.rotation.y = heading;
		m.root.rotation.x = -Math.max(-0.6, Math.min(0.6, Math.atan2(vy, Math.max(speed, 1))));
		m.lean.rotation.z = lean;
		// Rolling forward (+z) turns the tyre's top towards +z: a negative spin here.
		for (const w of m.wheels) w.rotation.z -= (speed / 0.42) * (1 / 60);
	}

	private camPos = new THREE.Vector3();
	private camLook = new THREE.Vector3();

	/** A chase camera behind the player, rolling a little with the bike. */
	private chase(dt: number) {
		const p = this.player;
		const fx = Math.sin(p.heading);
		const fz = Math.cos(p.heading);
		const back = 5.5 + p.speed * 0.03;
		// The camera only rises part way with a jump, so the bike flies up the screen.
		const lift = p.ground + (p.y - p.ground) * 0.35;
		const want = new THREE.Vector3(p.x - fx * back, lift + 2.4, p.z - fz * back);
		const look = new THREE.Vector3(p.x + fx * 6, lift + 1.1, p.z + fz * 6);
		const k = Math.min(1, dt * 7);
		if (this.camPos.lengthSq() === 0 || k >= 1) {
			this.camPos.copy(want);
			this.camLook.copy(look);
		} else {
			this.camPos.lerp(want, k);
			this.camLook.lerp(look, k);
		}
		this.camera.position.copy(this.camPos);
		this.camera.up.set(-fz * p.lean * 0.12, 1, fx * p.lean * 0.12).normalize();
		this.camera.lookAt(this.camLook);
		this.followSun(p.x, p.y, p.z);
	}

	/** Behind the menu: a slow circle round the grid. */
	private orbit() {
		const start = pointAt(this.track, -10);
		const a = this.clock * 0.15;
		this.camera.position.set(start.x + Math.sin(a) * 18, 5, start.z + Math.cos(a) * 18);
		this.camera.up.set(0, 1, 0);
		this.camera.lookAt(start.x, 1, start.z);
		this.camPos.set(0, 0, 0);
		this.followSun(start.x, 0, start.z);
	}

	private followSun(x: number, y: number, z: number) {
		this.sun.position.set(x + 60, y + 120, z + 40);
		this.sun.target.position.set(x, y, z);
	}
}

function bestLap() {
	const v = Number(localStorage.getItem(RECORD_KEY));
	return v > 0 ? v : undefined;
}
