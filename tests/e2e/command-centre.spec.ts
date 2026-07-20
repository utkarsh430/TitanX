import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/**
 * End-to-end coverage for the UPSRTC AI Operations Copilot command centre.
 * Runs at 1920x1080 — the presentation resolution.
 */

/** Console errors we tolerate: they originate outside our application code. */
const IGNORABLE_CONSOLE = [
  'Google Maps',
  'googleapis.com',
  'maps.googleapis',
  'billing',
  'ApiTargetBlockedMapError',
  'InvalidKeyMapError',
  'RefererNotAllowed',
  'net::ERR_',
  'Failed to load resource',
  'favicon',
];

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (IGNORABLE_CONSOLE.some((pattern) => text.includes(pattern))) return;
    errors.push(text);
  });
  page.on('pageerror', (error) => {
    if (IGNORABLE_CONSOLE.some((pattern) => error.message.includes(pattern))) return;
    errors.push(error.message);
  });
  return errors;
}

/** Wait for the live (or fixture) fleet to populate the navigation panel. */
async function waitForFleet(page: Page): Promise<void> {
  await expect(page.getByTestId('fleet-bus-row').first()).toBeVisible({ timeout: 60_000 });
}

async function selectFirstBus(page: Page): Promise<void> {
  await waitForFleet(page);
  await page.getByTestId('fleet-bus-row').first().click();
  await expect(page.getByTestId('bus-detail-drawer')).toBeVisible({ timeout: 30_000 });
}

test.describe('UPSRTC AI Operations Copilot', () => {
  test('1. command centre loads with identity and connection status', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /UPSRTC AI OPERATIONS COPILOT/i })).toBeVisible();
    await expect(page.getByText('Predictive Fleet Command Intelligence')).toBeVisible();
    await expect(page.getByText(/CONNECTED|FIXTURE|STALE CACHE|DEGRADED/).first()).toBeVisible();
  });

  test('2. live or fixture buses appear in the fleet panel and on the counter', async ({ page }) => {
    await page.goto('/');
    await waitForFleet(page);

    const rows = page.getByTestId('fleet-bus-row');
    expect(await rows.count()).toBeGreaterThan(0);

    // Registration numbers follow the real UPSRTC plate format.
    await expect(rows.first()).toContainText(/[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}/);
    await expect(page.getByTestId('visible-count')).toBeVisible();
  });

  test('3. selecting a bus opens its detail panel with live data', async ({ page }) => {
    await page.goto('/');
    await selectFirstBus(page);

    const drawer = page.getByTestId('bus-detail-drawer');
    await expect(drawer.getByText('LIVE UPSRTC DATA')).toBeVisible();
    await expect(drawer.getByText('Live UPSRTC GPS')).toBeVisible();
    await expect(drawer.getByText('Coordinates')).toBeVisible();
    await expect(drawer.getByText('Data Quality')).toBeVisible();
  });

  test('4. schedule is requested only after a bus is selected', async ({ page }) => {
    const scheduleRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/upsrtc/schedule')) scheduleRequests.push(request.url());
    });

    await page.goto('/');
    await waitForFleet(page);

    // Nothing should have asked for a schedule during initial fleet load.
    expect(scheduleRequests).toHaveLength(0);

    await page.getByTestId('fleet-bus-row').first().click();
    await expect(page.getByTestId('bus-detail-drawer')).toBeVisible();

    await expect.poll(() => scheduleRequests.length, { timeout: 30_000 }).toBeGreaterThan(0);

    // Exactly one vehicle is queried — never the whole fleet.
    expect(scheduleRequests.length).toBeLessThan(3);
    expect(scheduleRequests[0]).toContain('regNum=');
  });

  test('5. bunching demonstration launches and is labelled simulated', async ({ page }) => {
    await page.goto('/');
    await selectFirstBus(page);

    await page.getByTestId('demo-bunching').click();

    const stage = page.getByTestId('scenario-stage');
    await expect(stage).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('bunching-stage')).toBeVisible();
    await expect(stage.getByText('SIMULATED BUNCHING DEMO').first()).toBeVisible();
    await expect(stage.getByText('SELECTED LIVE BUS')).toBeVisible();
    await expect(stage.getByText('SIMULATED SERVICE A')).toBeVisible();
    await expect(stage.getByText('SIMULATED SERVICE C')).toBeVisible();
  });

  test('6. traffic demonstration launches with route comparison', async ({ page }) => {
    await page.goto('/');
    await selectFirstBus(page);

    await page.getByTestId('demo-traffic').click();

    await expect(page.getByTestId('traffic-stage')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('CURRENT ROUTE')).toBeVisible();
    await expect(page.getByText('SUGGESTED ALTERNATIVE')).toBeVisible();
    await expect(
      page.getByText(/Route diversion and driver instructions require authorized dispatcher approval/),
    ).toBeVisible();
  });

  test('7. breakdown demonstration launches with rescue candidates', async ({ page }) => {
    await page.goto('/');
    await selectFirstBus(page);

    await page.getByTestId('demo-breakdown').click();

    await expect(page.getByTestId('breakdown-stage')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('SIM-RESCUE-01').first()).toBeVisible();
    await expect(page.getByText('Passengers onboard')).toBeVisible();
    await expect(page.getByText('Breakdown detected')).toBeVisible();
  });

  test('8. demand demonstration launches with a working time slider', async ({ page }) => {
    await page.goto('/');
    await selectFirstBus(page);

    await page.getByTestId('demo-demand').click();

    await expect(page.getByTestId('demand-stage')).toBeVisible({ timeout: 20_000 });
    const slider = page.getByTestId('demand-time-slider');
    await expect(slider).toBeVisible();

    // Moving the slider must visibly change the demonstration.
    const before = await page.getByTestId('demand-stage').innerText();
    await slider.getByRole('button', { name: '5 PM' }).click();
    await expect
      .poll(async () => page.getByTestId('demand-stage').innerText(), { timeout: 10_000 })
      .not.toBe(before);
  });

  test('9. driver message simulation sends and receives acknowledgement', async ({ page }) => {
    await page.goto('/');
    await selectFirstBus(page);

    await page.getByTestId('demo-contact').click();

    const modal = page.getByTestId('driver-message-modal');
    await expect(modal).toBeVisible({ timeout: 20_000 });
    await expect(modal.getByText('DEMO MESSAGE — NO REAL DRIVER CONTACTED')).toBeVisible();

    // Bilingual draft is present.
    await expect(modal.getByText('English message')).toBeVisible();
    await expect(modal.getByText(/Hindi message/)).toBeVisible();

    await page.getByTestId('send-driver-message').click();

    await expect(page.getByTestId('message-status')).toBeVisible();
    await expect
      .poll(async () => page.getByTestId('message-status').innerText(), { timeout: 30_000 })
      .toMatch(/acknowledged/i);
  });

  test('10. VoIP simulation connects and ends cleanly', async ({ page }) => {
    await page.goto('/');
    await selectFirstBus(page);

    await page.getByTestId('demo-bunching').click();
    await expect(page.getByTestId('scenario-stage')).toBeVisible();

    await page.getByTestId('copilot-action-voip').click();

    const overlay = page.getByTestId('voip-overlay');
    await expect(overlay).toBeVisible({ timeout: 20_000 });
    await expect(overlay.getByText('PROTOTYPE VOIP SIMULATION — NO EXTERNAL CALL PLACED')).toBeVisible();

    await expect
      .poll(async () => page.getByTestId('call-status').innerText(), { timeout: 20_000 })
      .toMatch(/Connected/i);

    await page.getByTestId('end-call').click();
    await expect
      .poll(async () => page.getByTestId('call-status').innerText(), { timeout: 15_000 })
      .toMatch(/ended/i);
  });

  test('11. pitch mode starts, advances and exits', async ({ page }) => {
    await page.goto('/');
    await waitForFleet(page);

    await page.getByTestId('start-pitch-mode').click();

    const overlay = page.getByTestId('pitch-mode-overlay');
    await expect(overlay).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('pitch-caption')).toContainText(
      'Live visibility across the UPSRTC fleet',
    );

    // Pause holds the caption steady.
    await page.getByTestId('pitch-pause').click();
    await expect(page.getByTestId('pitch-pause')).toContainText(/Resume/i);

    await page.getByTestId('exit-pitch-mode').click();
    await expect(overlay).not.toBeVisible({ timeout: 15_000 });
  });

  test('12. live and simulated labels remain visible together', async ({ page }) => {
    await page.goto('/');
    await waitForFleet(page);

    // The top bar always distinguishes live data from simulated capability.
    await expect(page.getByText(/LIVE UPSRTC GPS|UPSRTC FIXTURE FALLBACK/).first()).toBeVisible();
    await expect(page.getByText('SIMULATED AI CAPABILITIES')).toBeVisible();

    await selectFirstBus(page);
    await page.getByTestId('demo-breakdown').click();
    await expect(page.getByTestId('breakdown-stage')).toBeVisible({ timeout: 20_000 });

    // Simulation labelling survives while a scenario is on screen.
    await expect(page.getByTestId('scenario-stage').getByText('SIMULATED BREAKDOWN DEMO').first()).toBeVisible();
    await expect(page.getByText(/LIVE UPSRTC GPS|UPSRTC FIXTURE FALLBACK/).first()).toBeVisible();
  });

  test('13. footer disclaimer is always accessible and expandable', async ({ page }) => {
    await page.goto('/');

    const footer = page.getByTestId('footer-disclaimer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText(/Only UPSRTC GPS locations and schedule information are live/);

    await footer.getByRole('button').click();
    await expect(footer).toContainText(/No real driver is contacted/);
    await expect(footer).toContainText(/No operational instruction is executed automatically/);
  });

  test('14. no unexpected JavaScript console errors occur during a full walkthrough', async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);

    await page.goto('/');
    await selectFirstBus(page);

    for (const testId of ['demo-bunching', 'demo-traffic', 'demo-breakdown', 'demo-demand']) {
      await page.getByTestId(testId).click();
      await expect(page.getByTestId('scenario-stage')).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(700);
    }

    await page.getByTestId('close-scenario').click();
    await page.waitForTimeout(400);

    expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('15. diagnostics, audit and scenario lab drawers open', async ({ page }) => {
    await page.goto('/');
    await waitForFleet(page);

    await page.getByRole('button', { name: /Diagnostics/i }).click();
    await expect(page.getByTestId('diagnostics-drawer')).toBeVisible();
    await expect(page.getByText('GPS Endpoint Health')).toBeVisible();
    // Secrets must never be surfaced here.
    await expect(page.getByTestId('diagnostics-drawer')).toContainText(/configured|MISSING/);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /Scenario Lab/i }).click();
    await expect(page.getByTestId('scenario-lab')).toBeVisible();
    await expect(page.getByTestId('reset-demonstration')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /Audit/i }).click();
    await expect(page.getByTestId('audit-drawer')).toBeVisible();
  });

  test('16. impact dashboard shows illustrative future figures', async ({ page }) => {
    await page.goto('/');
    await waitForFleet(page);

    await page.getByTestId('open-impact').click();

    const dashboard = page.getByTestId('impact-dashboard');
    await expect(dashboard).toBeVisible({ timeout: 15_000 });
    await expect(dashboard.getByText('ILLUSTRATIVE FUTURE IMPACT')).toBeVisible();
    await expect(dashboard.getByText(/Demonstration estimates only/)).toBeVisible();
    await expect(dashboard.getByText('Bunching incidents', { exact: true })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dashboard).not.toBeVisible({ timeout: 10_000 });
  });

  test('17. audit trail records the operator walkthrough', async ({ page }) => {
    await page.goto('/');
    await selectFirstBus(page);
    await page.getByTestId('demo-bunching').click();
    await expect(page.getByTestId('scenario-stage')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /Audit/i }).click();
    const drawer = page.getByTestId('audit-drawer');
    await expect(drawer).toBeVisible();

    await expect(drawer.getByText('Bus selected').first()).toBeVisible();
    await expect(drawer.getByText('Scenario launched').first()).toBeVisible();
    // Live vs simulated provenance is preserved per event.
    await expect(drawer.getByText('LIVE').first()).toBeVisible();
    await expect(drawer.getByText('SIM').first()).toBeVisible();
  });

  test('18. keyboard escape closes the bus detail drawer', async ({ page }) => {
    await page.goto('/');
    await selectFirstBus(page);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('bus-detail-drawer')).not.toBeVisible({ timeout: 10_000 });
  });
});
