import { expect, test } from '@playwright/test';
import { level01 } from '../src/levels/level-01';
import { applySolution, unlockThrough } from './helpers';

const noSideScroll = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [name, path] of [
  ['level map', './'],
  ['Level 1', './#/level/1'],
  ['Level 5 (most controls)', './#/level/5'],
  ['Level 6 (ten cooks)', './#/level/6'],
] as const) {
  test(`no horizontal scroll on ${name}`, async ({ page }) => {
    await unlockThrough(page, 8);
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
  });
}

test('Level 1 clears on a phone, and the debrief fits', async ({ page }) => {
  await page.goto('./#/level/1');
  await page.getByRole('button', { name: '20×' }).click();
  await applySolution(page, level01);
  await expect(page.getByRole('status')).toHaveText('Level cleared', { timeout: 30_000 });
  await page.getByRole('link', { name: 'See the debrief' }).click();
  await expect(page.getByRole('heading', { name: 'Level 1 cleared' })).toBeVisible();
  expect(await noSideScroll(page)).toBeLessThanOrEqual(0);
});
