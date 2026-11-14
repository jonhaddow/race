<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import type { Game, Hud } from '#lib/game/game.ts';
	import { LAPS, formatTime } from '#lib/game/race.ts';

	let game: Game | undefined;
	let hud = $state<Hud>();
	let touch = $state(false);
	let tilt = $state(false);
	let portrait = $state(false);
	let wakeLock: WakeLockSentinel | undefined;

	// The game (three.js) only loads in the browser, after the page shows.
	const mount: Attachment<HTMLCanvasElement> = (canvas) => {
		let stopped = false;
		let timer: ReturnType<typeof setInterval> | undefined;
		void import('#lib/game/game.ts').then(({ Game }) => {
			if (stopped) return;
			game = new Game(canvas);
			// The HUD needn't redraw every frame.
			timer = setInterval(() => {
				if (!game) return;
				hud = { ...game.hud };
				tilt = game.input.hasTilt;
			}, 80);
		});
		const coarse = matchMedia('(pointer: coarse)');
		const tall = matchMedia('(orientation: portrait)');
		const media = () => {
			touch = coarse.matches;
			portrait = tall.matches;
		};
		media();
		coarse.addEventListener('change', media);
		tall.addEventListener('change', media);
		return () => {
			stopped = true;
			clearInterval(timer);
			coarse.removeEventListener('change', media);
			tall.removeEventListener('change', media);
			game?.dispose();
		};
	};

	async function start() {
		if (!game) return;
		// iOS only asks for motion access from a tap, so this goes first.
		const { askForMotion } = await import('#lib/game/input.ts');
		if (touch) await askForMotion();
		if (touch && !document.fullscreenElement) {
			await document.documentElement.requestFullscreen?.().catch(() => {});
			const o = screen.orientation as ScreenOrientation & { lock?(o: string): Promise<void> };
			await o.lock?.('landscape').catch(() => {});
		}
		wakeLock = await navigator.wakeLock?.request('screen').catch(() => undefined);
		game.start();
		hud = { ...game.hud };
	}

	function setPaused(paused: boolean) {
		game?.setPaused(paused);
		if (game) hud = { ...game.hud };
	}

	function quit() {
		if (!game) return;
		game.hud.phase = 'menu';
		setPaused(false);
		void wakeLock?.release();
	}

	function onVisibility() {
		const racing = hud?.phase === 'countdown' || hud?.phase === 'racing';
		if (document.visibilityState === 'hidden' && racing) setPaused(true);
	}

	function onKey(e: KeyboardEvent) {
		if (e.code === 'Escape' || e.code === 'KeyP') {
			if (hud?.phase === 'racing' || hud?.phase === 'countdown') setPaused(!hud.paused);
		}
		if (e.code === 'Enter' && (hud?.phase === 'menu' || hud?.phase === 'finished')) void start();
	}

	/** Holds a control down while a finger is on the button. */
	const hold =
		(key: 'throttle' | 'brake' | 'left' | 'right'): Attachment<HTMLElement> =>
		(el) => {
			const set = (on: boolean) => (e: PointerEvent) => {
				e.preventDefault();
				if (game) game.input.touch[key] = on;
				el.classList.toggle('down', on);
			};
			const down = set(true);
			const up = set(false);
			el.addEventListener('pointerdown', down);
			el.addEventListener('pointerup', up);
			el.addEventListener('pointercancel', up);
			el.addEventListener('pointerleave', up);
			return () => {
				el.removeEventListener('pointerdown', down);
				el.removeEventListener('pointerup', up);
				el.removeEventListener('pointercancel', up);
				el.removeEventListener('pointerleave', up);
			};
		};

	const ordinal = (n: number) => ['1st', '2nd', '3rd'][n - 1] ?? `${n}th`;
	const playing = $derived(hud?.phase === 'countdown' || hud?.phase === 'racing');
</script>

<svelte:document onvisibilitychange={onVisibility} />
<svelte:window onkeydown={onKey} />

<canvas {@attach mount} aria-label="Race track"></canvas>

{#if !hud || hud.phase === 'menu'}
	<section class="menu">
		<h1>Race<span>.</span></h1>
		<p class="tag">Three laps. Three rivals. One line.</p>
		<button class="go" onclick={start} disabled={!hud}>{hud ? 'Start race' : 'Loading…'}</button>
		<p class="help">
			{#if touch}
				Tilt the phone to steer. Hold <b>Gas</b> on the right, <b>Brake</b> on the left.
			{:else}
				Arrows or WASD to ride, Space to brake, Esc to pause.
			{/if}
		</p>
		{#if hud?.bestLap}<p class="record">Best lap {formatTime(hud.bestLap)}</p>{/if}
	</section>
{/if}

{#if hud && playing}
	<div class="hud">
		<div class="panel pos" data-testid="position">
			<small>Pos</small><strong>{hud.position}</strong><em>/{hud.racers}</em>
		</div>
		<div class="panel lap" data-testid="lap">
			<small>Lap</small><strong>{hud.lap}</strong><em>/{LAPS}</em>
		</div>
		<div class="panel times">
			<span>{formatTime(hud.lapTime)}</span>
			{#if hud.lastLap}<span class="last">Last {formatTime(hud.lastLap)}</span>{/if}
			{#if hud.bestLap}<span class="last">Best {formatTime(hud.bestLap)}</span>{/if}
		</div>
		<button class="panel pause" onclick={() => setPaused(true)} aria-label="Pause">
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z" /></svg>
		</button>
		<div class="speed" data-testid="speed">
			<strong>{hud.speedKmh}</strong><small>km/h</small>
		</div>
	</div>

	{#if hud.phase === 'countdown'}
		<div class="count" aria-live="polite">{Math.ceil(hud.countdown)}</div>
	{:else if hud.raceTime < 1}
		<div class="count go-flash">Go</div>
	{/if}

	{#if touch}
		<div class="pedals">
			<div class="left">
				<button class="pad brake" {@attach hold('brake')}>Brake</button>
				{#if !tilt}
					<button class="pad steer" {@attach hold('left')} aria-label="Steer left">◀</button>
					<button class="pad steer" {@attach hold('right')} aria-label="Steer right">▶</button>
				{/if}
			</div>
			<button class="pad gas" {@attach hold('throttle')}>Gas</button>
		</div>
	{/if}
{/if}

{#if hud?.paused}
	<section class="sheet">
		<h2>Paused</h2>
		<button class="go" onclick={() => setPaused(false)}>Resume</button>
		<button class="ghost" onclick={start}>Restart</button>
		<button class="ghost" onclick={quit}>Quit</button>
	</section>
{/if}

{#if hud?.phase === 'finished' && hud.result}
	<section class="sheet" data-testid="result">
		<p class="flag">Finished</p>
		<h2>{ordinal(hud.result.position)}</h2>
		<dl>
			<dt>Race</dt>
			<dd>{formatTime(hud.result.time)}</dd>
			<dt>Best lap</dt>
			<dd>{formatTime(hud.result.bestLap)}{hud.result.newRecord ? ' · record' : ''}</dd>
		</dl>
		<button class="go" onclick={start}>Race again</button>
		<button class="ghost" onclick={quit}>Menu</button>
	</section>
{/if}

{#if touch && portrait}
	<div class="rotate">
		<svg viewBox="0 0 48 48" aria-hidden="true">
			<rect x="15" y="6" width="18" height="32" rx="2" />
			<path d="M8 30a18 18 0 0 0 16 12M8 30l-1 6M8 30l6 1" />
		</svg>
		<p>Turn your phone sideways</p>
	</div>
{/if}
