# Race

A 3D motorbike racing game that runs in the browser. Three laps of a hilly 2 km circuit with jumps, against three computer riders, steering by tilting your phone, or with the keyboard on a computer.

## Playing

- **Phone:** turn it sideways and tilt it like a steering wheel. Hold **Gas** on the right and **Brake** on the left. Where tilt isn't available, steering buttons appear instead.
- **Keyboard:** arrows or WASD, Space to brake, Esc to pause, Enter to start.

Your best lap is saved on the device. Add it to your home screen to play it full screen.

## Tech stack

- [three.js](https://threejs.org) for the 3D scene. Everything is built from primitives in code, so there are no model files.
- [SvelteKit](https://svelte.dev) (Svelte 5) and TypeScript for the page, HUD and menus
- [Cloudflare Workers](https://workers.cloudflare.com), deployed from `main` by Workers Builds
- [Vitest](https://vitest.dev) and [Playwright](https://playwright.dev) for tests

## Running locally

```sh
npm install
npm run dev
```

Tests: `npm test` (unit), `npm run test:e2e` (Playwright), `npm run check` (types), `npm run lint`.
