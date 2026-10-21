import { expect, test } from '@playwright/test';
import { LEVELS } from '../src/levels';

// Open each level, apply its stored solution through the controls, run at 20×,
// and expect "Level cleared" within 30 real seconds.
for (const level of LEVELS) {
  test(`Level ${level.number} clears with its solution`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('./');
    await expect(page.getByText(`Level ${level.number} · ${level.title}`)).toBeVisible();
    await expect(page.getByRole('status')).not.toHaveText('Level cleared');

    await page.getByRole('button', { name: '20×' }).click();
    const s = level.solution;
    if (s.cooks !== undefined) {
      const cooks = page.locator('.stepper .val');
      for (let i = 0; i < 10; i++) {
        const n = Number(await cooks.textContent());
        if (n === s.cooks) break;
        await page.getByRole('button', { name: n < s.cooks ? 'More cooks' : 'Fewer cooks' }).click();
      }
      await expect(cooks).toHaveText(String(s.cooks));
    }
    if (s.hedge) await page.getByLabel('Hedge slow orders').check();
    if (s.hedgeMs !== undefined) await page.getByLabel('Hedge after milliseconds').fill(String(s.hedgeMs));
    if (s.queueOrder) await page.getByRole('button', { name: s.queueOrder.toUpperCase() }).click();

    await expect(page.getByRole('status')).toHaveText('Level cleared', { timeout: 30_000 });
    expect(errors).toEqual([]);
  });
}

test('no horizontal scroll at 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await expect(page.getByRole('status')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
