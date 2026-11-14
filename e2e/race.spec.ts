import { expect, test } from '@playwright/test';

test('starts a race, counts down and rides off with the gas held', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/');
	const start = page.getByRole('button', { name: 'Start race' });
	// three.js loads after the page, then the button turns on.
	await expect(start).toBeEnabled({ timeout: 30_000 });
	await start.tap();

	await expect(page.getByTestId('lap')).toContainText('1/3');
	await expect(page.getByTestId('position')).toContainText('4/4');
	// No motion sensor here, so the steering buttons stand in for tilt.
	await expect(page.getByRole('button', { name: 'Steer left' })).toBeVisible();

	await page.getByRole('button', { name: 'Gas' }).dispatchEvent('pointerdown');
	await expect(page.getByTestId('speed')).not.toContainText(/^0km/, { timeout: 20_000 });

	await page.getByRole('button', { name: 'Pause' }).click();
	await page.getByRole('button', { name: 'Quit' }).click();
	await expect(start).toBeVisible();
	expect(errors).toEqual([]);
});
