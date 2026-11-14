# Race

A 3D motorbike racing game at https://race.app.haddow.me: three.js in a SvelteKit page. Unlike the other apps it has no sign-in, D1, push or service worker. It's a public game, and the best lap lives in `localStorage`.

## Worth knowing

- `src/lib/game/`: `track.ts`, `bike.ts`, `ai.ts`, `race.ts` and `tilt.ts` are pure and unit tested, so keep three.js out of them. `game.ts` runs the loop, while `world.ts` and `models.ts` build the scene from primitives.
- Conventions: heading h moves along (sin h, cos h) in x/z. Positive steer, lateral and lean are to the right, and positive curvature turns left.
- Tilt comes from `deviceorientation` (beta, gamma) relative to the screen orientation, not `devicemotion` (its gravity signs are flipped on iOS, which steered backwards there). calibrated to however the phone is held during the countdown. iOS needs `requestPermission` from a tap (the Start button).
- Game time slows below 20 fps (dt is capped at 0.05). Headless Chromium renders WebGL in software, so e2e runs at deviceScaleFactor 1.
- Tuning: rival skills are in `Game.setUp` (0.93/0.88/0.83 of the ideal pace), and grip and top speed are in `bike.ts`.
- The page sends `Permissions-Policy: accelerometer=(self)` (`hooks.server.ts`), which tilt needs.
- Screenshots: `node`/Playwright with `--enable-unsafe-swiftshader --use-angle=swiftshader` (see `playwright.config.ts`). `scripts/shot.sh` isn't here since there's no sign-in.
