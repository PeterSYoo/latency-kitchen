import { expect, test } from '@playwright/test';
import { LEVELS } from '../src/levels';
import { applySolution, unlockThrough } from './helpers';


// Open each level, apply its stored solution through the controls, run at 20×,
// and expect "Level cleared" within 30 real seconds.
for (const level of LEVELS) {
  test(`Level ${level.number} clears with its solution`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await unlockThrough(page, level.number);
    await page.goto(`./#/level/${level.number}`);
    await expect(page.getByText(`Level ${level.number} · ${level.title}`)).toBeVisible();
    await expect(page.getByRole('status')).not.toHaveText('Level cleared');

    await page.getByRole('button', { name: '20×' }).click();
    await applySolution(page, level);
    await expect(page.getByRole('status')).toHaveText('Level cleared', { timeout: 30_000 });

    await page.getByRole('link', { name: 'See the debrief' }).click();
    await expect(page.getByRole('heading', { name: `Level ${level.number} cleared` })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What you changed' })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('locked levels send you back to the map', async ({ page }) => {
  await page.goto('./#/level/3');
  await expect(page.getByText('/ Levels')).toBeVisible();
  await expect(page.getByText('Clear level 2 to unlock')).toBeVisible();
});

test('playing never overwrites progress saved by another tab', async ({ page, context }) => {
  await page.goto('./#/level/1');
  await expect(page.getByRole('status')).toBeVisible();
  // Another tab clears levels 1 and 2 while this one is playing.
  const other = await context.newPage();
  await other.goto('./');
  await other.evaluate((key) => {
    localStorage.setItem(key, JSON.stringify({ 'level-01': { stars: [true, false, false] }, 'level-02': { stars: [true, false, false] } }));
  }, 'latency-kitchen:progress:v1');
  await page.waitForTimeout(500);
  await page.goto('./#/level/3');
  await expect(page.getByText('Level 3 · Who goes first')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Level 3 · Who goes first')).toBeVisible();
});

test('progress survives a reload', async ({ page }) => {
  await unlockThrough(page, 3);
  await page.goto('./');
  await expect(page.getByRole('link', { name: /Level 3/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: /Level 3/ })).toBeVisible();
  await expect(page.getByText('Clear level 3 to unlock')).toBeVisible();
});
