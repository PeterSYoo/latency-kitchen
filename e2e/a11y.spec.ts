import { expect, test, type Page } from '@playwright/test';
import { unlockThrough } from './helpers';

/** Presses Tab until the focused element's accessible name or label matches. */
async function tabTo(page: Page, name: RegExp, max = 80) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      // Focus can pass through the page body between the last control and the first.
      if (!el || el === document.body || el === document.documentElement) return '';
      const id = el.getAttribute('id');
      const forLabel = id ? document.querySelector(`label[for="${id}"]`)?.textContent : '';
      return [el.getAttribute('aria-label'), forLabel, el.textContent].filter(Boolean).join(' | ');
    });
    if (name.test(label)) return;
  }
  throw new Error(`Never reached ${name} by keyboard`);
}

test('Level 1 can be played and cleared with only the keyboard', async ({ page }) => {
  await page.goto('./#/level/1');
  await expect(page.getByRole('status')).toBeVisible();
  await tabTo(page, /^20×$/);
  await page.keyboard.press('Enter');
  await tabTo(page, /Hedge slow orders/);
  await page.keyboard.press('Space');
  await expect(page.getByLabel('Hedge slow orders')).toBeChecked();
  await tabTo(page, /Hedge after milliseconds/);
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft'); // 120 → 90 ms
  await expect(page.getByLabel('Hedge after milliseconds')).toHaveValue('90');
  await expect(page.getByRole('status')).toHaveText('Level cleared', { timeout: 30_000 });
  await tabTo(page, /See the debrief/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Level 1 cleared' })).toBeVisible();
  await expect(page).toHaveTitle(/Debrief · Level 1/);
});

test('the skip button jumps straight to the controls', async ({ page }) => {
  await page.goto('./#/level/1');
  await expect(page.getByRole('status')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Skip to controls' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#controls')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Fewer cooks' })).toBeFocused();
});

test('focus is visible on every kind of control', async ({ page }) => {
  await page.goto('./#/level/1');
  for (const target of [page.getByRole('button', { name: '5×' }), page.getByLabel('Hedge slow orders'), page.getByRole('link', { name: 'Levels' })]) {
    await target.focus();
    const outline = await target.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
  }
});

test('every chart and control has an accessible name', async ({ page }) => {
  await unlockThrough(page, 8);
  for (const path of ['./#/level/5', './#/level/7']) {
    await page.goto(path);
    await expect(page.getByRole('status')).toBeVisible();
    const unnamed = await page.evaluate(() => {
      const missing: string[] = [];
      for (const el of document.querySelectorAll('canvas[role="img"]')) {
        if (!el.getAttribute('aria-label')?.trim()) missing.push(`canvas.${el.className}`);
      }
      for (const el of document.querySelectorAll('button, input, a')) {
        const id = el.getAttribute('id');
        const name = el.getAttribute('aria-label') || el.textContent?.trim() || (id && document.querySelector(`label[for="${id}"]`)?.textContent);
        if (!name) missing.push(el.outerHTML.slice(0, 60));
      }
      return missing;
    });
    expect(unnamed).toEqual([]);
  }
});

test('status is spelled out, not shown by colour alone', async ({ page }) => {
  await page.goto('./#/level/1');
  await expect(page.getByRole('status')).toHaveText('p99 breaching SLO');
  await expect(page.locator('.slo .tag').first()).toHaveText(/PASS|FAIL/);
  await expect(page.locator('.kpi.breach .tag')).toHaveText('FAIL');
});

test('the theme switch cycles and survives a reload', async ({ page }) => {
  await page.goto('./');
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-theme', /.+/);
  await page.getByRole('button', { name: /^Theme: System/ }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: /^Theme: Light/ }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(15, 18, 22)');
});

test('each screen has its own title', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('Latency Kitchen');
  await page.getByRole('link', { name: /Level 1/ }).click();
  await expect(page).toHaveTitle('Level 1 · Fix the stragglers · Latency Kitchen');
});
