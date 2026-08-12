const { test, expect } = require('@playwright/test');

const runId = process.env.GITHUB_RUN_ID || String(Date.now());
const email = process.env.E2E_BUILDER_EMAIL || `builder-${runId}@audora.local`;
const password = 'AudoraUITest2026!';

function localDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function register(page) {
  await page.goto('/#build', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toHaveAttribute('data-backend', 'online', { timeout: 30000 });
  await expect(page.locator('#backendStatus')).toBeVisible({ timeout: 15000 });
  await page.locator('#backendStatus').click();
  await page.locator('[data-auth-tab=register]').click();
  await page.locator('#authForm input[name=name]').fill('Builder UI Test');
  await page.locator('#authForm input[name=email]').fill(email);
  await page.locator('#authForm input[name=password]').fill(password);
  await page.locator('#authForm').evaluate(form => form.requestSubmit());
  await expect(page.locator('#backendStatus')).toContainText('Builder UI Test', { timeout: 20000 });
}

test('Smart Match lets the artist choose a suggested studio and persists that exact choice', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop-chromium');
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await register(page);
  await page.locator('.side-link[data-route=build]').click();
  await page.locator('#goalCards [data-goal=record]').click();
  await page.locator('#builderNext').click();

  const hipHop = page.locator('#genreChips button', { hasText: 'Hip-Hop' });
  if (!(await hipHop.evaluate(el => el.classList.contains('selected')))) await hipHop.click();
  await page.locator('#buildDate').fill(localDate(190));
  await page.locator('#budgetRange').fill('1500');
  await page.locator('#builderNext').click();

  await expect(page.locator('[data-builder-page="3"]')).toHaveClass(/active/);
  const choices = page.locator('[data-match-studio]');
  expect(await choices.count()).toBeGreaterThanOrEqual(2);

  const second = choices.nth(1);
  const selectedStudioId = await second.getAttribute('data-match-studio');
  expect(selectedStudioId).toBeTruthy();
  await second.click();

  await expect(page.locator(`[data-match-studio="${selectedStudioId}"]`)).toHaveClass(/selected/);
  await expect(page.locator('#matchTeam')).toHaveAttribute('data-selected-studio', selectedStudioId);

  await page.locator('#builderNext').click();
  await expect(page.locator('section[data-view=sessions]')).toHaveClass(/active/, { timeout: 20000 });

  const sessions = await page.evaluate(async () => (await fetch('/api/sessions/')).json());
  expect(sessions.results.some(session => session.status === 'confirmed' && session.studio?.id === selectedStudioId)).toBeTruthy();
  expect(pageErrors).toEqual([]);
});
