const { test, expect } = require('@playwright/test');

const runId = process.env.GITHUB_RUN_ID || String(Date.now());
const email = process.env.E2E_EMAIL || `ui-${runId}@audora.local`;
const password = 'AudoraUITest2026!';
const displayName = 'UI Test';
const listingName = `UI Studio ${runId}`;

function localDateTime(days, hour) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localDate(days) {
  return localDateTime(days, 12).slice(0, 10);
}

async function waitBackend(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toHaveAttribute('data-backend', 'online', { timeout: 30000 });
  await expect(page.locator('#backendStatus')).toBeAttached();
}

async function loginUi(page) {
  await expect(page.locator('#backendStatus')).toBeVisible({ timeout: 15000 });
  await page.locator('#backendStatus').click();
  await expect(page.locator('#authForm')).toBeVisible();
  await page.locator('#authForm input[name=email]').fill(email);
  await page.locator('#authForm input[name=password]').fill(password);
  await page.locator('#authForm').evaluate(form => form.requestSubmit());
  await expect(page.locator('#backendStatus')).toContainText(displayName, { timeout: 20000 });
}

async function closeFunctional(page) {
  const close = page.locator('[data-functional-close]');
  if (await close.isVisible().catch(() => false)) await close.click();
}

async function registerDesktop(page) {
  await page.locator('#backendStatus').click();
  await page.locator('[data-auth-tab=register]').click();
  await page.locator('#authForm input[name=name]').fill(displayName);
  await page.locator('#authForm input[name=email]').fill(email);
  await page.locator('#authForm input[name=password]').fill(password);
  await page.locator('#authForm').evaluate(form => form.requestSubmit());
  await expect(page.locator('#backendStatus')).toContainText(displayName, { timeout: 20000 });
}

test.describe.serial('Audora full production browser coverage', () => {
  test('desktop: all in-scope user and provider options work', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium');
    const pageErrors = [];
    const apiErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('[Audora API]')) apiErrors.push(msg.text());
    });
    page.on('dialog', dialog => dialog.accept());

    await test.step('backend and isolated demo', async () => {
      await waitBackend(page);
      await expect(page.locator('#backendStatus')).toContainText('Demo');
      const boot = await page.evaluate(async () => (await fetch('/api/bootstrap/')).json());
      expect(boot.user.is_demo).toBeTruthy();
      expect(boot.user.email).toBe('demo@audora.local');
    });

    await test.step('registration and account state', async () => {
      await registerDesktop(page);
      const boot = await page.evaluate(async () => (await fetch('/api/bootstrap/')).json());
      expect(boot.user.is_demo).toBeFalsy();
      expect(boot.user.email).toBe(email);
    });

    await test.step('language and all desktop navigation options', async () => {
      await page.locator('#languageButton').click();
      await page.locator('#languageMenu [data-lang=en]').click();
      await expect(page.locator('#currentLanguage')).toHaveText('EN');
      await page.locator('#languageButton').click();
      await page.locator('#languageMenu [data-lang=de]').click();
      await expect(page.locator('#currentLanguage')).toHaveText('DE');

      for (const route of ['home', 'discover', 'build', 'sessions', 'saved', 'inbox']) {
        await page.locator(`.side-link[data-route=${route}]`).click();
        await expect(page.locator(`section[data-view=${route}]`)).toHaveClass(/active/);
      }
      await page.locator('.profile-mini').click();
      await expect(page.locator('section[data-view=profile]')).toHaveClass(/active/);
    });

    await test.step('discover search, category, filters and map', async () => {
      await page.locator('.side-link[data-route=discover]').click();
      await page.locator('#mapToggle').click();
      await expect(page.locator('#discoverLayout')).toHaveClass(/map-open/);
      await expect(page.locator('#mapPanel')).toHaveClass(/open/);
      await page.locator('#categoryTabs [data-category=producer]').click();
      await expect(page.locator('#categoryTabs [data-category=producer]')).toHaveClass(/active/);
      await page.locator('#filterRow [data-filter=budget]').click();
      await expect(page.locator('#filterRow [data-filter=budget]')).toHaveClass(/active/);
      await page.locator('#filterRow [data-filter=instant]').click();
      await expect(page.locator('#filterRow [data-filter=instant]')).toHaveClass(/active/);
      await page.locator('#categoryTabs [data-category=all]').click();
      await page.locator('#filterRow [data-filter=recommended]').click();
    });

    await test.step('provider mode and listing create/edit', async () => {
      await page.locator('.profile-mini').click();
      await page.locator('#providerSwitch').click();
      await expect(page.locator('#providerSwitch')).toHaveClass(/active/);
      await page.locator('.profile-mini').click();
      await expect(page.locator('#providerDashboard')).toHaveClass(/open/);
      await page.locator('[data-demo-action=listing]').click();
      await expect(page.locator('[data-provider-new]')).toBeVisible();
      await page.locator('[data-provider-new]').click();
      await page.locator('#providerListingForm input[name=name]').fill(listingName);
      await page.locator('#providerListingForm select[name=category]').selectOption('studio');
      await page.locator('#providerListingForm input[name=city]').fill('Berlin');
      await page.locator('#providerListingForm input[name=price]').fill('77');
      await page.locator('#providerListingForm input[name=genres]').fill('Hip-Hop, R&B');
      await page.locator('#providerListingForm textarea[name=about_de]').fill('Automatisierter UI-Test');
      await page.locator('#providerListingForm textarea[name=about_en]').fill('Automated UI test');
      await page.locator('#providerListingForm input[name=instant]').check();
      await page.locator('#providerListingForm').evaluate(form => form.requestSubmit());

      const row = page.locator('.provider-listing-row', { hasText: listingName });
      await expect(row).toBeVisible({ timeout: 20000 });
      await row.locator('[data-provider-edit]').click();
      await page.locator('#providerListingForm input[name=price]').fill('79');
      await page.locator('#providerListingForm').evaluate(form => form.requestSubmit());
      await expect(page.locator('.provider-listing-row', { hasText: listingName })).toContainText('€79');
    });

    await test.step('provider availability add block and delete', async () => {
      const row = page.locator('.provider-listing-row', { hasText: listingName });
      await row.locator('[data-provider-availability]').click();
      await page.locator('#availabilityForm input[name=start]').fill(localDateTime(120, 10));
      await page.locator('#availabilityForm input[name=end]').fill(localDateTime(120, 18));
      await page.locator('#availabilityForm select[name=available]').selectOption('true');
      await page.locator('#availabilityForm').evaluate(form => form.requestSubmit());
      await expect(page.locator('.availability-row').first()).toBeVisible({ timeout: 15000 });

      await page.locator('#availabilityForm input[name=start]').fill(localDateTime(121, 10));
      await page.locator('#availabilityForm input[name=end]').fill(localDateTime(121, 12));
      await page.locator('#availabilityForm select[name=available]').selectOption('false');
      await page.locator('#availabilityForm').evaluate(form => form.requestSubmit());
      const blocked = page.locator('.availability-row', { hasText: /Blockiert|Blocked/ });
      await expect(blocked).toBeVisible();
      await blocked.locator('[data-slot-delete]').click();
      await expect(page.locator('.availability-row', { hasText: /Blockiert|Blocked/ })).toHaveCount(0);
      await closeFunctional(page);
    });

    await test.step('search, favorite and saved persistence', async () => {
      await page.locator('.side-link[data-route=discover]').click();
      await page.locator('#discoverSearch').fill(listingName);
      const card = page.locator('#discoverGrid [data-listing-card]', { hasText: listingName });
      await expect(card).toBeVisible({ timeout: 15000 });
      await card.locator('[data-favorite]').click();
      await expect(card.locator('[data-favorite]')).toHaveClass(/active/);
      await page.locator('.side-link[data-route=saved]').click();
      await expect(page.locator('#savedGrid [data-listing-card]', { hasText: listingName })).toBeVisible();
      const boot = await page.evaluate(async () => (await fetch('/api/bootstrap/')).json());
      expect(boot.favorites.length).toBeGreaterThan(0);
    });

    await test.step('listing detail and review', async () => {
      const saved = page.locator('#savedGrid [data-listing-card]', { hasText: listingName });
      await saved.locator('[data-view-listing]').click();
      await expect(page.locator('#listingModal')).toHaveClass(/open/);
      await expect(page.locator('[data-review-form]')).toBeVisible();
      await page.locator('[data-review-form] select[name=rating]').selectOption('5');
      await page.locator('[data-review-form] input[name=comment]').fill('UI E2E review');
      await page.locator('[data-review-form]').evaluate(form => form.requestSubmit());
      await expect(page.locator('#listingDetail')).toContainText('UI E2E review', { timeout: 15000 });
    });

    await test.step('direct booking and collision protection', async () => {
      await page.locator('#listingDetail [data-book-listing]').click();
      await expect(page.locator('#directBookingForm')).toBeVisible();
      await page.locator('#directBookingForm input[name=start]').fill(localDateTime(120, 11));
      await page.locator('#directBookingForm select[name=duration]').selectOption('2');
      await page.locator('#directBookingForm textarea[name=notes]').fill('UI booking test');
      await page.locator('#directBookingForm').evaluate(form => form.requestSubmit());
      await expect(page.locator('#directBookingMessage')).toHaveClass(/success/, { timeout: 15000 });
      await page.waitForTimeout(900);

      const bookings = await page.evaluate(async () => (await fetch('/api/bookings/')).json());
      expect(bookings.results.some(x => x.listing.name === listingName && x.status === 'confirmed')).toBeTruthy();
      const conflict = await page.evaluate(async ({ listingName }) => {
        const listings = await (await fetch('/api/listings/?q=' + encodeURIComponent(listingName))).json();
        const listing = listings.results.find(x => x.name === listingName);
        const start = new Date();
        start.setDate(start.getDate() + 120); start.setHours(11, 0, 0, 0);
        const response = await fetch('/api/bookings/', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({listing_id:listing.id,start_at:start.toISOString(),duration_hours:2}) });
        return { status:response.status, body:await response.json() };
      }, { listingName });
      expect(conflict.status).toBe(409);
      expect(conflict.body.error).toBe('slot_just_booked');
    });

    await test.step('inbox conversation and persisted message', async () => {
      await page.locator('.side-link[data-route=discover]').click();
      await page.locator('#discoverSearch').fill('Jona');
      const card = page.locator('#discoverGrid [data-listing-card]').filter({ hasText: /Jona/ }).first();
      await expect(card).toBeVisible({ timeout: 15000 });
      await card.locator('[data-view-listing]').click();
      await page.locator('#listingDetail [data-message-listing]').click();
      await expect(page.locator('section[data-view=inbox]')).toHaveClass(/active/);
      await page.locator('#messageText').fill('UI persisted message');
      await page.locator('#messageForm').evaluate(form => form.requestSubmit());
      await expect(page.locator('#messages .message.me').last()).toContainText('UI persisted message');
      const conversations = await page.evaluate(async () => (await fetch('/api/conversations/')).json());
      expect(conversations.results.some(c => c.messages?.some(m => m.text === 'UI persisted message'))).toBeTruthy();
    });

    await test.step('session builder and session room options', async () => {
      await page.locator('.side-link[data-route=build]').click();
      await page.locator('#goalCards [data-goal=record]').click();
      await page.locator('#builderNext').click();
      const hipHop = page.locator('#genreChips button', { hasText: 'Hip-Hop' });
      if (!(await hipHop.evaluate(el => el.classList.contains('active')))) await hipHop.click();
      await page.locator('#buildDate').fill(localDate(150));
      await page.locator('#budgetRange').fill('900');
      await page.locator('#builderNext').click();
      await expect(page.locator('[data-builder-page="3"]')).toHaveClass(/active/);
      await page.locator('#builderNext').click();
      await expect(page.locator('section[data-view=sessions]')).toHaveClass(/active/, { timeout: 20000 });

      const sessionsApi = await page.evaluate(async () => (await fetch('/api/sessions/')).json());
      const created = sessionsApi.results.find(x => x.status === 'confirmed');
      expect(created).toBeTruthy();
      const row = page.locator('.session-item').filter({ hasText: created.title }).first();
      await expect(row).toBeVisible();
      await row.locator('[data-open-session]').click();
      await expect(page.locator('#sessionRoom')).toHaveClass(/open/);

      const pendingTask = page.locator('[data-server-task]:not(.done)').first();
      await expect(pendingTask).toBeVisible();
      await pendingTask.click();
      await expect(pendingTask).toHaveClass(/done/);

      await page.locator('#roomTabs [data-room-tab=files]').click();
      await page.locator('[data-session-upload]').setInputFiles({ name:'ui-reference.txt', mimeType:'text/plain', buffer:Buffer.from('Audora UI test') });
      await expect(page.locator('#roomContent')).toContainText('ui-reference.txt', { timeout: 15000 });
      await page.locator('#roomTabs [data-room-tab=team]').click();
      await expect(page.locator('.room-team-row').first()).toBeVisible();
      await page.locator('#roomTabs [data-room-tab=chat]').click();
      await expect(page.locator('#roomContent')).toContainText(/Team-Chat|Team chat/);
      await page.locator('#roomTabs [data-room-tab=overview]').click();
      await page.locator('[data-session-cancel]').click();
      await expect(page.locator('[data-session-cancel]')).toHaveCount(0, { timeout: 15000 });
      await page.locator('#closeSessionRoom').click();
      await page.locator('#sessionTabs [data-session-filter=past]').click();
      await expect(page.locator('.session-item').filter({ hasText: created.title }).first()).toBeVisible();
    });

    await test.step('notifications mark read and do not block UI', async () => {
      await page.locator('#notificationButton').click();
      await expect(page.locator('#notificationPanel')).toHaveClass(/open/);
      const notification = page.locator('[data-notification-id]').first();
      await expect(notification).toBeVisible();
      await notification.click();
      await expect(page.locator('#notificationPanel')).not.toHaveClass(/open/);
      const notices = await page.evaluate(async () => (await fetch('/api/notifications/')).json());
      expect(notices.results.some(n => n.read)).toBeTruthy();
    });

    await test.step('profile options and AI Smart Match UI', async () => {
      await page.locator('.profile-mini').click();
      await page.locator('#editProfile').click();
      await expect(page.locator('#settingsModal')).toHaveClass(/open/);
      await page.locator('#settingsModal [data-close-modal]').click();
      await page.locator('[data-settings=security]').click();
      await expect(page.locator('#settingsModal')).toHaveClass(/open/);
      await page.locator('#settingsModal [data-close-modal]').click();

      await page.locator('.brand-button[data-route=home]').first().click();
      await page.locator('#aiFab').click();
      await expect(page.locator('#aiPanel')).toHaveClass(/open/);
      await page.locator('#aiPanel [data-ai=build]').click();
      await expect(page.locator('section[data-view=build]')).toHaveClass(/active/);
      const match = await page.evaluate(async () => {
        const r = await fetch('/api/match/', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({goal:'record',city:'Berlin',genres:['Hip-Hop'],budget:900})});
        return r.json();
      });
      expect(match.score).toBeGreaterThanOrEqual(80);
      expect(match.studio).toBeTruthy();
    });

    await test.step('logout/login and persisted saved/session data', async () => {
      await page.locator('#backendStatus').click();
      await page.locator('[data-auth-logout]').click();
      await expect(page.locator('#backendStatus')).toContainText('Demo', { timeout: 20000 });
      await loginUi(page);
      await page.locator('.side-link[data-route=saved]').click();
      await expect(page.locator('#savedGrid [data-listing-card]', { hasText: listingName })).toBeVisible();
      await page.locator('.side-link[data-route=sessions]').click();
      await page.locator('#sessionTabs [data-session-filter=past]').click();
      await expect(page.locator('.session-item').first()).toBeVisible();
    });

    await test.step('provider listing delete removes marketplace item', async () => {
      await page.locator('.profile-mini').click();
      if (!(await page.locator('#providerSwitch').evaluate(el => el.classList.contains('active')))) await page.locator('#providerSwitch').click();
      await page.locator('[data-demo-action=listing]').click();
      const row = page.locator('.provider-listing-row', { hasText: listingName });
      await expect(row).toBeVisible();
      await row.locator('[data-provider-delete]').click();
      await expect(page.locator('.provider-listing-row', { hasText: listingName })).toHaveCount(0, { timeout: 15000 });
      await closeFunctional(page);
      await page.locator('.side-link[data-route=discover]').click();
      await page.locator('#discoverSearch').fill(listingName);
      await expect(page.locator('#discoverGrid [data-listing-card]', { hasText: listingName })).toHaveCount(0);
    });

    expect(pageErrors, `Browser page errors: ${pageErrors.join('\n')}`).toEqual([]);
    expect(apiErrors, `Frontend API errors: ${apiErrors.join('\n')}`).toEqual([]);
  });

  test('mobile: account, navigation, marketplace and listing modal work', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-chromium');
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await waitBackend(page);
    await loginUi(page);
    await expect(page.locator('.mobile-nav')).toBeVisible();

    for (const route of ['home', 'discover', 'build', 'sessions', 'profile']) {
      await page.locator(`.mobile-nav [data-route=${route}]`).click();
      await expect(page.locator(`section[data-view=${route}]`)).toHaveClass(/active/);
    }

    await page.locator('.mobile-nav [data-route=discover]').click();
    await page.locator('#discoverSearch').fill('Neon');
    const card = page.locator('#discoverGrid [data-listing-card]').first();
    await expect(card).toBeVisible();
    await card.locator('[data-view-listing]').click();
    await expect(page.locator('#listingModal')).toHaveClass(/open/);
    await page.locator('#listingModal [data-close-modal]').click();
    expect(pageErrors, `Mobile page errors: ${pageErrors.join('\n')}`).toEqual([]);
  });
});
