const { test, expect } = require('@playwright/test');

const runId = process.env.GITHUB_RUN_ID || String(Date.now());
const email = process.env.E2E_TEAM_EMAIL || `team-${runId}@audora.local`;
const password = 'AudoraUITest2026!';

function futureDate(days = 90) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function register(page) {
  await page.goto('/#build', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toHaveAttribute('data-backend', 'online', { timeout: 30000 });
  await page.locator('#backendStatus').click();
  await page.locator('[data-auth-tab=register]').click();
  await page.locator('#authForm input[name=name]').fill('Team Selection Test');
  await page.locator('#authForm input[name=email]').fill(email);
  await page.locator('#authForm input[name=password]').fill(password);
  await page.locator('#authForm').evaluate(form => form.requestSubmit());
  await expect(page.locator('#backendStatus')).toContainText('Team Selection Test', { timeout: 20000 });
}

async function login(page) {
  await page.goto('/#build', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toHaveAttribute('data-backend', 'online', { timeout: 30000 });
  await page.locator('#backendStatus').click();
  await page.locator('#authForm input[name=email]').fill(email);
  await page.locator('#authForm input[name=password]').fill(password);
  await page.locator('#authForm').evaluate(form => form.requestSubmit());
  await expect(page.locator('#backendStatus')).toContainText('Team Selection Test', { timeout: 20000 });
}

async function setSchedule(page, days = 90) {
  await page.locator('#buildDate').fill(futureDate(days));
  await expect(page.locator('#buildTime')).toBeVisible();
  await page.locator('#buildTime').fill('20:00');
}

test.describe.serial('Audora selectable Smart Match team', () => {
  test('artist chooses studio, producer and engineer and exact team is persisted', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium');
    const pageErrors = [];
    const apiErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('[Audora API]')) apiErrors.push(msg.text());
    });

    await register(page);
    await page.locator('.side-link[data-route=build]').click();
    await page.locator('#goalCards [data-goal=record]').click();
    await page.locator('#builderNext').click();

    const hipHop = page.locator('#genreChips button', { hasText: 'Hip-Hop' });
    if (!(await hipHop.evaluate(el => el.classList.contains('selected')))) await hipHop.click();
    await page.locator('#buildCity').selectOption({ label: 'Frankfurt' }).catch(async () => {
      await page.locator('#buildCity').selectOption('Frankfurt');
    });
    await setSchedule(page, 90);
    await page.locator('#budgetRange').fill('1500');
    await page.locator('#builderNext').click();

    await expect(page.locator('[data-builder-page="3"]')).toHaveClass(/active/);
    await expect(page.locator('script[src="/builder-team-selection.js"]')).toHaveCount(1);

    const studios = page.locator('[data-builder-studio]');
    await expect(studios.nth(1)).toBeVisible({ timeout: 15000 });
    expect(await studios.count()).toBeGreaterThanOrEqual(2);
    const selectedStudioId = await studios.nth(1).getAttribute('data-builder-studio');
    await studios.nth(1).click();
    await expect(page.locator(`[data-builder-studio="${selectedStudioId}"]`)).toHaveClass(/selected/);

    const selectedStudioCity = await page.evaluate(async studioId => {
      const response = await fetch(`/api/listings/${encodeURIComponent(studioId)}/`);
      const studio = await response.json();
      return studio.city;
    }, selectedStudioId);
    await expect(page.locator('#summaryPlace')).toHaveText(selectedStudioCity);

    const producers = page.locator('[data-builder-role-choice="producer"][data-builder-member]:not([data-builder-member=""])');
    await expect(producers.nth(1)).toBeVisible({ timeout: 15000 });
    expect(await producers.count()).toBeGreaterThanOrEqual(2);
    const selectedProducerId = await producers.nth(1).getAttribute('data-builder-member');
    await producers.nth(1).click();
    await expect(page.locator(`[data-builder-role-choice="producer"][data-builder-member="${selectedProducerId}"]`)).toHaveClass(/selected/);

    const engineers = page.locator('[data-builder-role-choice="engineer"][data-builder-member]:not([data-builder-member=""])');
    await expect(engineers.first()).toBeVisible({ timeout: 15000 });
    const selectedEngineerId = await engineers.first().getAttribute('data-builder-member');
    await engineers.first().click();
    await expect(page.locator(`[data-builder-role-choice="engineer"][data-builder-member="${selectedEngineerId}"]`)).toHaveClass(/selected/);

    expect(await page.locator('#summaryTotal').textContent()).toMatch(/^€\d+/);

    await page.locator('#builderNext').click();
    await expect(page.locator('section[data-view=sessions]')).toHaveClass(/active/, { timeout: 20000 });

    const result = await page.evaluate(async ({ studioId, producerId, engineerId }) => {
      const data = await (await fetch('/api/sessions/')).json();
      return data.results.find(session =>
        ['confirmed', 'pending'].includes(session.status) &&
        session.studio?.id === studioId &&
        session.team?.some(member => member.id === producerId) &&
        session.team?.some(member => member.id === engineerId)
      );
    }, { studioId: selectedStudioId, producerId: selectedProducerId, engineerId: selectedEngineerId });

    expect(result).toBeTruthy();
    expect(result.city).toBe(selectedStudioCity);
    expect(pageErrors).toEqual([]);
    expect(apiErrors).toEqual([]);
  });

  test('artist can skip engineer and saved session keeps that choice', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium');
    await login(page);
    await page.locator('#goalCards [data-goal=record]').click();
    await page.locator('#builderNext').click();
    await setSchedule(page, 91);
    await page.locator('#builderNext').click();

    const skipEngineer = page.locator('[data-builder-role-choice="engineer"][data-builder-member=""]');
    await expect(skipEngineer).toBeVisible({ timeout: 15000 });
    await skipEngineer.click();
    await expect(skipEngineer).toHaveClass(/selected/);

    const studioId = await page.locator('[data-builder-studio].selected').getAttribute('data-builder-studio');
    const producerId = await page.locator('[data-builder-role-choice="producer"].selected').getAttribute('data-builder-member');
    await page.locator('#builderNext').click();
    await expect(page.locator('section[data-view=sessions]')).toHaveClass(/active/, { timeout: 20000 });

    const saved = await page.evaluate(async ({ studioId, producerId }) => {
      const data = await (await fetch('/api/sessions/')).json();
      return data.results.find(session =>
        session.studio?.id === studioId &&
        session.team?.some(member => member.id === producerId) &&
        !session.team?.some(member => member.category === 'engineer')
      );
    }, { studioId, producerId });
    expect(saved).toBeTruthy();
  });
});