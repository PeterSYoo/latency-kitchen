import { expect, test, type Page } from '@playwright/test';
import { LEVELS } from '../src/levels';
import type { LevelConfig } from '../src/levels/types';

const KEY = 'latency-kitchen:progress:v1';

/** Marks every level before `n` as cleared, so level n is unlocked. */
async function unlockThrough(page: Page, n: number) {
  const progress = Object.fromEntries(
    LEVELS.filter((l) => l.number < n).map((l) => [l.id, { stars: [true, false, false] }]),
  );
  await page.addInitScript(
    ([key, value]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    [KEY, JSON.stringify(progress)] as const,
  );
}

async function setStepper(page: Page, group: string, target: number, less: string, more: string) {
  const g = page.getByRole('group', { name: group });
  const val = g.locator('.val');
  for (let i = 0; i < 12; i++) {
    const n = Number(await val.textContent());
    if (n === target) break;
    await g.getByRole('button', { name: n < target ? more : less }).click();
  }
  await expect(val).toHaveText(String(target));
}

/** Applies a level's stored solution through the visible controls. */
async function applySolution(page: Page, level: LevelConfig) {
  const s = { ...level.solution };
  if (s.arrivalRate !== undefined) await page.getByLabel('Orders accepted').fill(String(s.arrivalRate));
  if (s.cooks !== undefined) await setStepper(page, 'Cooks', s.cooks, 'Fewer cooks', 'More cooks');
  if (s.hedge) await page.getByLabel('Hedge slow orders').check();
  if (s.hedgeMs !== undefined) await page.getByLabel('Hedge after milliseconds').fill(String(s.hedgeMs));
  if (s.queueOrder) await page.getByRole('button', { name: s.queueOrder.toUpperCase() }).click();
  if (s.shed) await page.getByLabel('Shed load').check();
  if (s.shedMax !== undefined) await page.getByLabel('Maximum orders waiting').fill(String(s.shedMax));
  if (s.cache) await page.getByLabel('Prep ahead (cache)').check();
  if (s.timeout) await page.getByLabel('Give up and reorder').check();
  if (s.timeoutMs !== undefined) await page.getByLabel('Give up after milliseconds').fill(String(s.timeoutMs));
  if (s.maxRetries !== undefined) await setStepper(page, 'Retries', s.maxRetries, 'Fewer retries', 'More retries');
  if (s.backoffMs !== undefined) await page.getByLabel('Backoff milliseconds').fill(String(s.backoffMs));
  if (s.cancel) await page.getByLabel('Cancel abandoned orders').check();
}

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

test('progress survives a reload', async ({ page }) => {
  await unlockThrough(page, 3);
  await page.goto('./');
  await expect(page.getByRole('link', { name: /Level 3/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: /Level 3/ })).toBeVisible();
  await expect(page.getByText('Clear level 3 to unlock')).toBeVisible();
});

for (const path of ['./', './#/level/1']) {
  test(`no horizontal scroll at 390 px on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await expect(page.locator('.wrap')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
