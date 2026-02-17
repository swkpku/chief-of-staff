import { test, expect } from '@playwright/test';

test.describe('Life Management Features', () => {
  // ── Navigation ──────────────────────────────────────────────────────

  test.describe('Navigation', () => {
    test('default view is briefing (HOME)', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=JOBRUNNER', { timeout: 10000 });

      // HOME tab should be active (teal color)
      const homeTab = page.locator('button:has-text("HOME")');
      await expect(homeTab).toBeVisible();

      // Briefing content should be visible
      const briefingHeading = page.locator('text=TODAY\'S BRIEFING');
      await expect(briefingHeading).toBeVisible({ timeout: 10000 });
    });

    test('nav bar has all tabs', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=JOBRUNNER', { timeout: 10000 });

      for (const tab of ['HOME', 'AGENTS', 'KNOWLEDGE', 'REVIEW', 'SETTINGS']) {
        await expect(page.locator(`button:has-text("${tab}")`)).toBeVisible();
      }
    });

    test('clicking AGENTS tab shows job list and timeline', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=JOBRUNNER', { timeout: 10000 });

      await page.click('button:has-text("AGENTS")');
      await expect(page.locator('text=Jobs')).toBeVisible({ timeout: 5000 });
    });

    test('clicking KNOWLEDGE tab shows knowledge log', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=JOBRUNNER', { timeout: 10000 });

      await page.click('button:has-text("KNOWLEDGE")');
      await expect(page.locator('text=Knowledge Log')).toBeVisible({ timeout: 5000 });
    });

    test('clicking REVIEW tab shows weekly review', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=JOBRUNNER', { timeout: 10000 });

      await page.click('button:has-text("REVIEW")');
      await expect(page.locator('text=Weekly Review')).toBeVisible({ timeout: 5000 });
    });

    test('clicking SETTINGS tab shows settings', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=JOBRUNNER', { timeout: 10000 });

      await page.click('button:has-text("SETTINGS")');
      await expect(page.locator('text=Settings')).toBeVisible({ timeout: 5000 });
    });

    test('clicking JOBRUNNER logo returns to briefing', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=JOBRUNNER', { timeout: 10000 });

      // Navigate away first
      await page.click('button:has-text("SETTINGS")');
      await expect(page.locator('text=Settings')).toBeVisible({ timeout: 5000 });

      // Click logo to go home
      await page.click('text=JOBRUNNER');
      await expect(page.locator('text=TODAY\'S BRIEFING')).toBeVisible({ timeout: 5000 });
    });
  });

  // ── Briefing View ───────────────────────────────────────────────────

  test.describe('Briefing View', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=TODAY\'S BRIEFING', { timeout: 10000 });
    });

    test('shows TOP PRIORITIES section', async ({ page }) => {
      const section = page.locator('text=TOP PRIORITIES');
      await expect(section).toBeVisible();
    });

    test('shows DOMAIN HEALTH section', async ({ page }) => {
      const section = page.locator('text=DOMAIN HEALTH');
      await expect(section).toBeVisible({ timeout: 5000 });
    });

    test('domain health bars are clickable', async ({ page }) => {
      // Wait for domain health to load
      await page.waitForSelector('text=DOMAIN HEALTH', { timeout: 5000 });

      // Domain health items should have cursor: pointer
      const hasClickableHealth = await page.evaluate(() => {
        const allDivs = Array.from(document.querySelectorAll('div'));
        return allDivs.some(el => {
          return el.style.cursor === 'pointer' &&
                 el.closest('[style]')?.textContent?.includes('DOMAIN HEALTH');
        });
      });
      expect(hasClickableHealth).toBe(true);
    });

    test('priority items show rank numbers', async ({ page }) => {
      const rankNumber = page.locator('text=/^[1-5]$/').first();
      // If there are priorities, rank numbers should be visible
      const count = await rankNumber.count();
      // Either there are priorities with ranks, or the "No priorities" message
      const noPriorities = page.locator('text=No priorities for today');
      const hasPriorities = count > 0;
      const hasNoPrioritiesMsg = await noPriorities.count() > 0;
      expect(hasPriorities || hasNoPrioritiesMsg).toBe(true);
    });

    test('priority items have action buttons', async ({ page }) => {
      // Check if there are priorities with Done/Defer/Snooze buttons
      const doneBtn = page.locator('button:has-text("Done")');
      const noPriorities = page.locator('text=No priorities for today');

      const hasDone = await doneBtn.count() > 0;
      const hasNoPrioritiesMsg = await noPriorities.count() > 0;
      expect(hasDone || hasNoPrioritiesMsg).toBe(true);
    });
  });

  // ── Quick Capture ───────────────────────────────────────────────────

  test.describe('Quick Capture', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=JOBRUNNER', { timeout: 10000 });
    });

    test('capture bar is visible on all views', async ({ page }) => {
      const captureInput = page.locator('input[placeholder*="Quick capture"]');
      await expect(captureInput).toBeVisible();
    });

    test('capture bar has domain selector', async ({ page }) => {
      const domainBtn = page.locator('button:has-text("Domain")');
      await expect(domainBtn).toBeVisible();
    });

    test('domain dropdown opens on click', async ({ page }) => {
      const domainBtn = page.locator('button:has-text("Domain")');
      await domainBtn.click();

      // Should show domain options
      await expect(page.locator('text=Auto-detect')).toBeVisible({ timeout: 3000 });
      await expect(page.locator('text=Email')).toBeVisible();
      await expect(page.locator('text=Projects')).toBeVisible();
      await expect(page.locator('text=Household')).toBeVisible();
    });

    test('capture bar has submit button', async ({ page }) => {
      const captureBtn = page.locator('button:has-text("Capture")');
      await expect(captureBtn).toBeVisible();
    });

    test('submitting capture shows toast notification', async ({ page }) => {
      const captureInput = page.locator('input[placeholder*="Quick capture"]');
      await captureInput.fill('Test task for projects domain');

      const captureBtn = page.locator('button:has-text("Capture")');
      await captureBtn.click();

      // Should show success toast
      const toast = page.locator('text=/Captured:/');
      await expect(toast).toBeVisible({ timeout: 5000 });
    });

    test('capture input clears after successful submit', async ({ page }) => {
      const captureInput = page.locator('input[placeholder*="Quick capture"]');
      await captureInput.fill('Another test task');

      const captureBtn = page.locator('button:has-text("Capture")');
      await captureBtn.click();

      // Wait for success toast
      await page.waitForSelector('text=/Captured:/', { timeout: 5000 });

      // Input should be cleared
      const value = await captureInput.inputValue();
      expect(value).toBe('');
    });
  });

  // ── Knowledge Log ───────────────────────────────────────────────────

  test.describe('Knowledge Log', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=JOBRUNNER', { timeout: 10000 });
      await page.click('button:has-text("KNOWLEDGE")');
      await page.waitForSelector('text=Knowledge Log', { timeout: 5000 });
    });

    test('shows knowledge log heading', async ({ page }) => {
      await expect(page.locator('text=Knowledge Log')).toBeVisible();
    });

    test('has domain filter dropdown', async ({ page }) => {
      const domainFilter = page.locator('select').first();
      await expect(domainFilter).toBeVisible();
    });

    test('shows knowledge entries or empty state', async ({ page }) => {
      // Wait for loading to finish
      await page.waitForTimeout(1000);

      const entries = page.locator('[style*="borderRadius: 8px"]');
      const emptyMsg = page.locator('text=No knowledge entries yet');

      const hasEntries = await entries.count() > 0;
      const hasEmptyMsg = await emptyMsg.count() > 0;
      expect(hasEntries || hasEmptyMsg).toBe(true);
    });
  });

  // ── Weekly Review ───────────────────────────────────────────────────

  test.describe('Weekly Review', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=JOBRUNNER', { timeout: 10000 });
      await page.click('button:has-text("REVIEW")');
      await page.waitForSelector('text=Weekly Review', { timeout: 5000 });
    });

    test('shows weekly review heading', async ({ page }) => {
      await expect(page.locator('text=Weekly Review')).toBeVisible();
    });

    test('has refresh review button', async ({ page }) => {
      const refreshBtn = page.locator('button:has-text("REFRESH REVIEW")');
      await expect(refreshBtn).toBeVisible();
    });
  });

  // ── Settings ────────────────────────────────────────────────────────

  test.describe('Settings', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('text=JOBRUNNER', { timeout: 10000 });
      await page.click('button:has-text("SETTINGS")');
      await page.waitForSelector('text=Settings', { timeout: 5000 });
    });

    test('shows settings heading', async ({ page }) => {
      await expect(page.locator('text=Settings')).toBeVisible();
    });

    test('shows demo mode indicator', async ({ page }) => {
      const demoMode = page.locator('text=Demo Mode');
      await expect(demoMode).toBeVisible();
    });

    test('shows connections section', async ({ page }) => {
      await expect(page.locator('text=CONNECTIONS')).toBeVisible();
    });

    test('shows domains section', async ({ page }) => {
      await expect(page.locator('text=DOMAINS')).toBeVisible();
    });

    test('shows recurring templates section', async ({ page }) => {
      await expect(page.locator('text=RECURRING TEMPLATES')).toBeVisible();
    });

    test('shows goals section with add form', async ({ page }) => {
      await expect(page.locator('text=GOALS')).toBeVisible();

      const addBtn = page.locator('button:has-text("ADD")');
      await expect(addBtn).toBeVisible();
    });

    test('can add a goal', async ({ page }) => {
      const goalInput = page.locator('input[placeholder="New goal..."]');
      await goalInput.fill('Test goal for e2e');

      const addBtn = page.locator('button:has-text("ADD")');
      await addBtn.click();

      // Goal should appear in the list
      await expect(page.locator('text=Test goal for e2e')).toBeVisible({ timeout: 5000 });
    });

    test('domain badges have colored dots', async ({ page }) => {
      const hasDomainDots = await page.evaluate(() => {
        const allSpans = Array.from(document.querySelectorAll('div'));
        return allSpans.some(el => {
          const style = el.style;
          return style.borderRadius === '50%' &&
                 (style.width === '10px' || style.height === '10px');
        });
      });
      expect(hasDomainDots).toBe(true);
    });
  });

  // ── API Endpoints ───────────────────────────────────────────────────

  test.describe('API Endpoints', () => {
    test('GET /api/priorities returns data', async ({ request }) => {
      const res = await request.get('http://localhost:5173/api/priorities');
      expect(res.ok()).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty('priorities');
      expect(Array.isArray(data.priorities)).toBe(true);
    });

    test('GET /api/briefing/today returns data', async ({ request }) => {
      const res = await request.get('http://localhost:5173/api/briefing/today');
      expect(res.ok()).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty('briefing');
    });

    test('GET /api/items returns data', async ({ request }) => {
      const res = await request.get('http://localhost:5173/api/items');
      expect(res.ok()).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
    });

    test('GET /api/domains returns domain list', async ({ request }) => {
      const res = await request.get('http://localhost:5173/api/domains');
      expect(res.ok()).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty('domains');
      expect(Array.isArray(data.domains)).toBe(true);
      expect(data.domains.length).toBe(5);
    });

    test('GET /api/connections returns connection status', async ({ request }) => {
      const res = await request.get('http://localhost:5173/api/connections');
      expect(res.ok()).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty('connections');
      expect(data).toHaveProperty('demo_mode');
    });

    test('GET /api/domain-health returns health data', async ({ request }) => {
      const res = await request.get('http://localhost:5173/api/domain-health');
      expect(res.ok()).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty('health');
    });

    test('GET /api/knowledge returns entries', async ({ request }) => {
      const res = await request.get('http://localhost:5173/api/knowledge');
      expect(res.ok()).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty('entries');
      expect(Array.isArray(data.entries)).toBe(true);
    });

    test('GET /api/goals returns goals', async ({ request }) => {
      const res = await request.get('http://localhost:5173/api/goals');
      expect(res.ok()).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty('goals');
      expect(Array.isArray(data.goals)).toBe(true);
    });

    test('GET /api/templates returns templates', async ({ request }) => {
      const res = await request.get('http://localhost:5173/api/templates');
      expect(res.ok()).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty('templates');
      expect(Array.isArray(data.templates)).toBe(true);
    });

    test('POST /api/capture parses input correctly', async ({ request }) => {
      const res = await request.post('http://localhost:5173/api/capture', {
        data: { text: 'Pay electric bill by Friday' },
      });
      expect(res.ok()).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty('parsed');
      expect(data.parsed.domain).toBe('household');
    });

    test('POST /api/capture detects kids domain', async ({ request }) => {
      const res = await request.post('http://localhost:5173/api/capture', {
        data: { text: 'Schedule pediatrician appointment for Emma' },
      });
      expect(res.ok()).toBe(true);
      const data = await res.json();
      expect(data.parsed.domain).toBe('kids');
    });

    test('POST /api/capture accepts domain override', async ({ request }) => {
      const res = await request.post('http://localhost:5173/api/capture', {
        data: { text: 'Review quarterly report', domain: 'career' },
      });
      expect(res.ok()).toBe(true);
      const data = await res.json();
      expect(data.parsed.domain).toBe('career');
    });

    test('POST /api/goals creates a goal', async ({ request }) => {
      const res = await request.post('http://localhost:5173/api/goals', {
        data: { domain: 'career', description: 'E2E test goal' },
      });
      expect(res.ok()).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty('id');
      expect(data.domain).toBe('career');
      expect(data.description).toBe('E2E test goal');
    });

    test('GET /api/items filters by domain', async ({ request }) => {
      const res = await request.get('http://localhost:5173/api/items?domain=email');
      expect(res.ok()).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty('items');
      // All items should be from email domain
      for (const item of data.items) {
        expect(item.domain).toBe('email');
      }
    });

    test('GET /api/review/latest returns review data', async ({ request }) => {
      const res = await request.get('http://localhost:5173/api/review/latest');
      expect(res.ok()).toBe(true);
      const data = await res.json();
      // review may be null if never generated
      expect(data).toHaveProperty('review');
    });

    test('GET /api/settings returns config', async ({ request }) => {
      const res = await request.get('http://localhost:5173/api/settings');
      expect(res.ok()).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty('config');
    });
  });
});
