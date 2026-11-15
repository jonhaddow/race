# Race

A 3D motorbike racing game at https://race.app.haddow.me: three.js in a SvelteKit page. Unlike the other apps it has no sign-in, D1, push or service worker. It's a public game, and the best lap lives in `localStorage`. It's also sent to the shared leaderboard in the games launcher (`~/code/games`, `src/lib/board.ts`), in milliseconds, on load and after each race. The launcher hands over the player's id as `#profile=<id>` in its links, kept in `localStorage` (`games-profile`).

## Worth knowing

- `src/lib/game/`: `track.ts`, `terrain.ts`, `bike.ts`, `ai.ts`, `race.ts` and `tilt.ts` are pure and unit tested, so keep three.js out of them. `game.ts` runs the loop, while `world.ts` and `models.ts` build the scene from primitives.
- Conventions: heading h moves along (sin h, cos h) in x/z. Positive steer, lateral and lean are to the right, and positive curvature turns left.
- Tilt comes from `deviceorientation` (beta, gamma) relative to the screen orientation, not `devicemotion` (its gravity signs are flipped on iOS, which steered backwards there). It is calibrated to however the phone is held during the countdown. iOS needs `requestPermission` from a tap (the Start button).
- Game time slows below 20 fps (dt is capped at 0.05). Headless Chromium renders WebGL in software, so e2e runs at deviceScaleFactor 1.
- Aimed at young kids: arcade handling, not realism. Grip is high, and steering harder than the grip allows slows the bike by itself (`SCRUB`), so corners work with the gas held. The road is 16 m wide.
- Tuning: rival skills are in `Game.setUp` (0.88/0.83/0.78 of the ideal pace), and riders ease off when ahead of the player (`pace` in `ai.ts`). Grip, top speed, gravity and how sticky crests are live in `bike.ts`.
- Hills: each `CIRCUIT` point has a height. `terrain.ts` shapes the ground to follow the road. Ramps (`RAMPS`) only lift the road's width, and only their lip launches bikes (`STICK`), never hill crests. Keep ramps on straights with a flat or uphill landing, since a downhill landing flies on into the next bend.
- Testing a lap: headless WebGL is too slow to play in real time, so step `game.update(1/60)` from `page.evaluate`, with `input.read` swapped for `cruise()` as an autopilot.
- The page sends `Permissions-Policy: accelerometer=(self), gyroscope=(self)` (`hooks.server.ts`), which tilt needs.
- Screenshots: `node`/Playwright with `--enable-unsafe-swiftshader --use-angle=swiftshader` (see `playwright.config.ts`). `scripts/shot.sh` isn't here since there's no sign-in.
