import { expect, type Page } from '@playwright/test';
import { LEVELS } from '../src/levels';
import type { LevelConfig } from '../src/levels/types';

export const PROGRESS_KEY = 'latency-kitchen:progress:v1';

/** Marks every level before `n` as cleared, so level n is unlocked. */
export async function unlockThrough(page: Page, n: number) {
  const progress = Object.fromEntries(
    LEVELS.filter((l) => l.number < n).map((l) => [l.id, { stars: [true, false, false] }]),
  );
  await page.addInitScript(
    ([key, value]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    [PROGRESS_KEY, JSON.stringify(progress)] as const,
  );
}

export async function setStepper(page: Page, group: string | RegExp, target: number, less: string, more: string) {
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
export async function applySolution(page: Page, level: LevelConfig) {
  const s = { ...level.solution };
  if (s.arrivalRate !== undefined) await page.getByLabel('Orders accepted').fill(String(s.arrivalRate));
  if (s.cooks !== undefined) await setStepper(page, 'Cooks', s.cooks, 'Fewer cooks', 'More cooks');
  if (s.quorum !== undefined) await setStepper(page, /Dishes needed/, s.quorum, 'Fewer dishes', 'More dishes');
  if (s.staggerPauses) await page.getByLabel('Stagger pauses').check();
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
