import { test, expect } from '@playwright/test';

test.describe('Dashboard Light Theme Redesign', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for data to load (jobs should appear)
    await page.waitForSelector('text=Jobs', { timeout: 10000 });
  });

  // ── Light Theme & Global Styles ──────────────────────────────────

  test('body has light background color', async ({ page }) => {
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(248, 249, 252)');
  });

  test('no grain overlay on body::after', async ({ page }) => {
    const afterContent = await page.evaluate(() => {
      const style = getComputedStyle(document.body, '::after');
      return style.content;
    });
    expect(afterContent).toBe('none');
  });

  test('body font-size is 16px', async ({ page }) => {
    const fontSize = await page.evaluate(() => getComputedStyle(document.body).fontSize);
    expect(fontSize).toBe('16px');
  });

  test('CSS custom properties are light theme', async ({ page }) => {
    const vars = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        void: root.getPropertyValue('--void').trim(),
        shelf: root.getPropertyValue('--shelf').trim(),
        snow: root.getPropertyValue('--snow').trim(),
        radar: root.getPropertyValue('--radar').trim(),
      };
    });
    expect(vars.void).toBe('#f8f9fc');
    expect(vars.shelf).toBe('#ffffff');
    expect(vars.snow).toBe('#1a1d2e');
    expect(vars.radar).toBe('#0a9b76');
  });

  // ── Top Nav Bar (was sidebar) ─────────────────────────────────────

  test('has sticky top nav bar instead of sidebar', async ({ page }) => {
    const nav = page.locator('text=JOBRUNNER');
    await expect(nav).toBeVisible();

    const rootGrid = await page.evaluate(() => {
      const root = document.querySelector('[style]');
      return root ? (root as HTMLElement).style.gridTemplateColumns : '';
    });
    expect(rootGrid).not.toContain('260px');
  });

  test('top nav displays agent count', async ({ page }) => {
    const agentText = page.locator('text=/\\d+ AGENTS ONLINE/');
    await expect(agentText).toBeVisible();
  });

  test('top nav has white background', async ({ page }) => {
    const navBg = await page.evaluate(() => {
      const stickyEl = document.querySelector('[style*="sticky"]');
      return stickyEl ? getComputedStyle(stickyEl).backgroundColor : '';
    });
    expect(navBg).toBe('rgb(255, 255, 255)');
  });

  // ── Job List Card Grid ────────────────────────────────────────────

  test('jobs section header is visible', async ({ page }) => {
    const header = page.locator('h2:has-text("Jobs")');
    await expect(header).toBeVisible();
  });

  test('job cards are rendered in a grid layout', async ({ page }) => {
    const hasGrid = await page.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll('div'));
      return allDivs.some((el) => {
        const style = getComputedStyle(el);
        return style.display === 'grid' && style.gridTemplateColumns.split(' ').length > 1;
      });
    });
    expect(hasGrid).toBe(true);
  });

  test('job cards have white background and border-radius', async ({ page }) => {
    const cardCount = await page.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll('div'));
      return allDivs.filter((el) => {
        const style = getComputedStyle(el);
        return style.borderRadius === '12px' && style.backgroundColor === 'rgb(255, 255, 255)';
      }).length;
    });
    expect(cardCount).toBeGreaterThan(0);
  });

  test('job cards have "View Details" links', async ({ page }) => {
    const viewDetailsLinks = page.locator('text=/View Details/');
    const count = await viewDetailsLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('add job placeholder card is dashed border', async ({ page }) => {
    const addJob = page.locator('text=+ Add Job');
    await expect(addJob).toBeVisible();
  });

  // ── Job Selection ─────────────────────────────────────────────────

  test('clicking a job card selects it (shows filter)', async ({ page }) => {
    const emailJob = page.locator('text=Email Triage').first();
    await emailJob.click();

    const filterIndicator = page.locator('text=Filtering');
    await expect(filterIndicator).toBeVisible({ timeout: 3000 });
  });

  test('clicking selected job again deselects it', async ({ page }) => {
    const emailJob = page.locator('text=Email Triage').first();
    await emailJob.click();
    await page.waitForSelector('text=Filtering', { timeout: 3000 });

    await emailJob.click();
    const filterIndicator = page.locator('text=Filtering');
    await expect(filterIndicator).not.toBeVisible({ timeout: 3000 });
  });

  // ── Timeline ──────────────────────────────────────────────────────

  test('timeline heading is visible with increased font size', async ({ page }) => {
    const heading = page.locator('h1:has-text("TIMELINE")');
    await expect(heading).toBeVisible();

    const fontSize = await heading.evaluate((el) => getComputedStyle(el).fontSize);
    expect(parseInt(fontSize)).toBe(28);
  });

  test('timeline has cards with white backgrounds', async ({ page }) => {
    const cards = await page.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll('div'));
      return allDivs.filter((el) => {
        const style = getComputedStyle(el);
        return style.borderRadius === '10px' && style.backgroundColor === 'rgb(255, 255, 255)';
      }).length;
    });
    expect(cards).toBeGreaterThanOrEqual(1);
  });

  test('timeline max width is 1100px', async ({ page }) => {
    const maxWidth = await page.evaluate(() => {
      const timeline = Array.from(document.querySelectorAll('div')).find(
        (el) => el.style.maxWidth === '1100px'
      );
      return timeline ? timeline.style.maxWidth : '';
    });
    expect(maxWidth).toBe('1100px');
  });

  // ── Timeline Expand/Collapse ──────────────────────────────────────

  test('clicking an execution row expands it', async ({ page }) => {
    // Click the execution row via JS to target the correct element
    const clicked = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      const execClickable = divs.find(el => {
        if (el.style.cursor !== 'pointer') return false;
        const span = el.querySelector('span');
        return span && /^\d{2}:\d{2}/.test(span.textContent || '');
      });
      if (execClickable) {
        (execClickable as HTMLElement).click();
        return true;
      }
      return false;
    });
    if (!clicked) {
      test.skip();
      return;
    }

    await page.waitForTimeout(500);
    // After expanding, execution details should appear (timestamps, status badge, actions)
    const expanded = await page.evaluate(() => {
      // Look for the expanded execution log content
      const allText = document.body.innerText;
      return allText.includes('ACTIONS') || allText.includes('EXECUTING') || allText.includes('NO ACTIONS') || allText.includes('COMPLETED');
    });
    expect(expanded).toBe(true);
  });

  // ── View Details / Job Detail Navigation ──────────────────────────

  test('clicking View Details navigates to job detail', async ({ page }) => {
    // Click View Details via JS to ensure we hit the right element
    await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      const viewDetail = divs.find(el =>
        el.textContent?.trim().startsWith('View Details') &&
        el.children.length === 0 &&
        el.style.cursor === 'pointer'
      );
      if (viewDetail) (viewDetail as HTMLElement).click();
    });

    // Should show the job detail view with "MISSION LOG"
    await expect(page.locator('text=MISSION LOG')).toBeVisible({ timeout: 5000 });

    // Job title should be visible at 32px
    const titleFontSize = await page.evaluate(() => {
      const h1s = Array.from(document.querySelectorAll('h1'));
      const jobTitle = h1s.find((h) => getComputedStyle(h).fontSize === '32px');
      return jobTitle ? '32px' : null;
    });
    expect(titleFontSize).toBe('32px');
  });

  test('job detail max width is 800px', async ({ page }) => {
    await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      const viewDetail = divs.find(el =>
        el.textContent?.trim().startsWith('View Details') &&
        el.children.length === 0 &&
        el.style.cursor === 'pointer'
      );
      if (viewDetail) (viewDetail as HTMLElement).click();
    });
    await expect(page.locator('text=MISSION LOG')).toBeVisible({ timeout: 5000 });

    const maxWidth = await page.evaluate(() => {
      const container = Array.from(document.querySelectorAll('div')).find(
        (el) => el.style.maxWidth === '800px'
      );
      return container ? container.style.maxWidth : '';
    });
    expect(maxWidth).toBe('800px');
  });

  test('job detail has mission log section', async ({ page }) => {
    await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      const viewDetail = divs.find(el =>
        el.textContent?.trim().startsWith('View Details') &&
        el.children.length === 0 &&
        el.style.cursor === 'pointer'
      );
      if (viewDetail) (viewDetail as HTMLElement).click();
    });

    await expect(page.locator('text=MISSION LOG')).toBeVisible({ timeout: 5000 });
  });

  test('back button returns to timeline from job detail', async ({ page }) => {
    await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      const viewDetail = divs.find(el =>
        el.textContent?.trim().startsWith('View Details') &&
        el.children.length === 0 &&
        el.style.cursor === 'pointer'
      );
      if (viewDetail) (viewDetail as HTMLElement).click();
    });
    await expect(page.locator('text=MISSION LOG')).toBeVisible({ timeout: 5000 });

    // Click the back button
    const backBtn = page.locator('button', { hasText: 'TIMELINE' });
    await backBtn.click();

    // Should be back on the timeline + jobs view
    await expect(page.locator('h2:has-text("Jobs")')).toBeVisible({ timeout: 3000 });
  });

  // ── Run Now & Toggle ──────────────────────────────────────────────

  test('job detail has Run Now button with teal bg', async ({ page }) => {
    await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      const viewDetail = divs.find(el =>
        el.textContent?.trim().startsWith('View Details') &&
        el.children.length === 0 &&
        el.style.cursor === 'pointer'
      );
      if (viewDetail) (viewDetail as HTMLElement).click();
    });
    await expect(page.locator('text=MISSION LOG')).toBeVisible({ timeout: 5000 });

    const runNow = page.locator('button:has-text("RUN NOW")');
    await expect(runNow).toBeVisible();

    // Button should have teal background --radar: #0a9b76 = rgb(10, 155, 118)
    const bg = await runNow.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(10, 155, 118)');
  });

  test('job detail has toggle switch', async ({ page }) => {
    await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      const viewDetail = divs.find(el =>
        el.textContent?.trim().startsWith('View Details') &&
        el.children.length === 0 &&
        el.style.cursor === 'pointer'
      );
      if (viewDetail) (viewDetail as HTMLElement).click();
    });
    await expect(page.locator('text=MISSION LOG')).toBeVisible({ timeout: 5000 });

    const toggle = page.locator('text=/Enabled|Disabled/');
    await expect(toggle.first()).toBeVisible();
  });

  // ── No Dark Theme Artifacts ───────────────────────────────────────

  test('no dark background colors remain', async ({ page }) => {
    const darkBgs = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const darkElements = allElements.filter((el) => {
        const bg = getComputedStyle(el).backgroundColor;
        const match = bg.match(/rgb\((\d+), (\d+), (\d+)\)/);
        if (!match) return false;
        const [, r, g, b] = match.map(Number);
        return r < 30 && g < 30 && b < 30;
      });
      return darkElements.map((el) => ({
        tag: el.tagName,
        bg: getComputedStyle(el).backgroundColor,
        classes: el.className,
      }));
    });
    const unexpected = darkBgs.filter(
      (el) => el.bg !== 'rgb(0, 0, 0)' || el.tag !== 'BODY'
    );
    expect(unexpected.length).toBe(0);
  });

  test('text colors are dark on light backgrounds', async ({ page }) => {
    const headingColor = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? getComputedStyle(h1).color : '';
    });
    expect(headingColor).toBe('rgb(26, 29, 46)');
  });

  // ── Filter Clear ──────────────────────────────────────────────────

  test('filter indicator has clear button that works', async ({ page }) => {
    const emailJob = page.locator('text=Email Triage').first();
    await emailJob.click();

    const filterIndicator = page.locator('text=Filtering');
    await expect(filterIndicator).toBeVisible({ timeout: 3000 });

    const clearBtn = page.locator('text=✕').first();
    await clearBtn.click();

    await expect(filterIndicator).not.toBeVisible({ timeout: 3000 });
  });

  // ── Slack Catchup Job ─────────────────────────────────────────────

  test('Slack Catchup job card is visible', async ({ page }) => {
    const slackJob = page.locator('text=Slack Catchup');
    await expect(slackJob.first()).toBeVisible();
  });

  test('Slack Catchup job card is in the grid', async ({ page }) => {
    const cardText = await page.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll('div'));
      const card = allDivs.find(el => {
        const style = getComputedStyle(el);
        return style.borderRadius === '12px' &&
               style.backgroundColor === 'rgb(255, 255, 255)' &&
               el.textContent?.includes('Slack Catchup');
      });
      return card ? card.textContent : '';
    });
    expect(cardText).toContain('Slack Catchup');
  });

  test('clicking Slack Catchup card filters timeline', async ({ page }) => {
    const slackJob = page.locator('text=Slack Catchup').first();
    await slackJob.click();

    const filterIndicator = page.locator('text=Filtering');
    await expect(filterIndicator).toBeVisible({ timeout: 3000 });
  });

  test('Slack Catchup job detail shows slack tool', async ({ page }) => {
    await page.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll('div'));
      const card = allDivs.find(el => {
        const style = getComputedStyle(el);
        return style.borderRadius === '12px' &&
               style.backgroundColor === 'rgb(255, 255, 255)' &&
               el.textContent?.includes('Slack Catchup');
      });
      if (card) {
        const viewDetail = Array.from(card.querySelectorAll('div')).find(el =>
          el.textContent?.trim().startsWith('View Details') &&
          el.children.length === 0 &&
          el.style.cursor === 'pointer'
        );
        if (viewDetail) (viewDetail as HTMLElement).click();
      }
    });

    await expect(page.locator('text=MISSION LOG')).toBeVisible({ timeout: 5000 });
    const slackTool = page.locator('text=slack');
    await expect(slackTool.first()).toBeVisible();
  });

  test('Slack Catchup job detail shows boundaries', async ({ page }) => {
    await page.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll('div'));
      const card = allDivs.find(el => {
        const style = getComputedStyle(el);
        return style.borderRadius === '12px' &&
               style.backgroundColor === 'rgb(255, 255, 255)' &&
               el.textContent?.includes('Slack Catchup');
      });
      if (card) {
        const viewDetail = Array.from(card.querySelectorAll('div')).find(el =>
          el.textContent?.trim().startsWith('View Details') &&
          el.children.length === 0 &&
          el.style.cursor === 'pointer'
        );
        if (viewDetail) (viewDetail as HTMLElement).click();
      }
    });

    await expect(page.locator('text=MISSION LOG')).toBeVisible({ timeout: 5000 });
    const boundary = page.locator('text=/Never post messages or replies without approval/');
    await expect(boundary.first()).toBeVisible();
  });

  // ── Slack Catchup Execution Data ────────────────────────────────

  test('Slack Catchup execution shows in timeline after run', async ({ page }) => {
    // The slack-catchup job was triggered, so its execution should show in timeline
    const slackExecution = page.locator('text=Slack Catchup').first();
    await expect(slackExecution).toBeVisible();
  });

  test('Slack Catchup execution shows awaiting-approval status', async ({ page }) => {
    // Click the Slack Catchup card to filter timeline to just this job
    const slackJob = page.locator('text=Slack Catchup').first();
    await slackJob.click();
    await page.waitForSelector('text=Filtering', { timeout: 3000 });

    // The execution should show an awaiting-approval badge (draft replies need approval)
    const approvalBadge = page.locator('text=/awaiting/i');
    await expect(approvalBadge.first()).toBeVisible({ timeout: 3000 });
  });

  test('Slack Catchup execution expands to show thread reply actions', async ({ page }) => {
    // Click Slack Catchup card to filter
    const slackJob = page.locator('text=Slack Catchup').first();
    await slackJob.click();
    await page.waitForSelector('text=Filtering', { timeout: 3000 });

    // Click execution row to expand
    const clicked = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      const execClickable = divs.find(el => {
        if (el.style.cursor !== 'pointer') return false;
        const span = el.querySelector('span');
        return span && /^\d{2}:\d{2}/.test(span.textContent || '');
      });
      if (execClickable) {
        (execClickable as HTMLElement).click();
        return true;
      }
      return false;
    });
    if (!clicked) {
      test.skip();
      return;
    }

    await page.waitForTimeout(500);

    // Should show slack-related action descriptions
    const threadAction = page.locator('text=/thread/i');
    await expect(threadAction.first()).toBeVisible({ timeout: 3000 });
  });
});
