import { defineConfig, devices } from '@playwright/test';

// End-to-end tests drive the real game in a landscape phone-sized Chromium.
// Its own port: other apps' tests use 5180-5190, and sessions run them at once.
const PORT = 5191;

export default defineConfig({
	testDir: 'e2e',
	forbidOnly: !!process.env.CI,
	timeout: 60_000,
	reporter: [['list']],
	use: {
		baseURL: `http://localhost:${PORT}`,
		...devices['Pixel 7 landscape'],
		// WebGL in headless Chromium runs on its slow software renderer: fewer pixels
		// keep the frame rate (and so game time) up.
		deviceScaleFactor: 1,
		trace: 'retain-on-failure',
		launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] }
	},
	webServer: {
		command: `npx vite dev --port ${PORT} --strictPort`,
		url: `http://localhost:${PORT}/`,
		reuseExistingServer: !!process.env.E2E_REUSE,
		timeout: 120_000
	}
});
