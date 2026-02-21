/**
 * Accessibility Audit Tests
 *
 * These tests validate WCAG 2.1 AA compliance on GitHub pages using
 * patterns discovered by MCP Accessibility Bridge.
 *
 * Claude prompt used:
 *   > "Navigate to github.com and run a full accessibility audit.
 *      Check for missing labels, wrong roles, improper heading hierarchy,
 *      and focus management issues. Write tests for each issue found."
 *
 * This file shows how the MCP server turns accessibility insights into
 * repeatable, automated regression tests.
 */

import { test, expect, Page } from '@playwright/test';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Collect all buttons on the page and return those with empty accessible names.
 * MCP revealed: icon-only buttons often have name="" in the AX tree.
 */
async function getUnlabelledButtons(page: Page): Promise<number> {
  return page.evaluate(() => {
    const buttons = document.querySelectorAll('button, [role="button"]');
    let unlabelled = 0;
    for (const btn of buttons) {
      const label =
        btn.getAttribute('aria-label') ||
        btn.getAttribute('aria-labelledby') ||
        btn.textContent?.trim();
      if (!label) unlabelled++;
    }
    return unlabelled;
  });
}

/**
 * Check heading hierarchy: h1 → h2 → h3 with no skipped levels.
 * get_accessibility_tree shows role=heading, level=N for each heading.
 */
async function checkHeadingHierarchy(page: Page): Promise<{ skipped: string[] }> {
  const skipped: string[] = [];
  const headings = await page.$$eval(
    'h1, h2, h3, h4, h5, h6',
    (els) => els.map((el) => ({
      level: parseInt(el.tagName[1]),
      text: el.textContent?.trim().slice(0, 60) ?? '',
    }))
  );

  let prevLevel = 0;
  for (const h of headings) {
    if (h.level > prevLevel + 1 && prevLevel !== 0) {
      skipped.push(`Skipped from h${prevLevel} to h${h.level}: "${h.text}"`);
    }
    prevLevel = h.level;
  }
  return { skipped };
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Accessibility Audit — GitHub Home', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page has exactly one h1', async ({ page }) => {
    // get_accessibility_tree audit: WCAG 2.4.6 — one main heading per page
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);
  });

  test('heading hierarchy has no skipped levels', async ({ page }) => {
    const { skipped } = await checkHeadingHierarchy(page);
    expect(skipped, `Skipped heading levels found:\n${skipped.join('\n')}`).toHaveLength(0);
  });

  test('page has required ARIA landmark regions', async ({ page }) => {
    // WCAG 1.3.6 / ARIA spec: pages must have navigation landmarks
    // Confirmed via get_accessibility_tree: banner, main, contentinfo present
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });

  test('navigation links have discernible text', async ({ page }) => {
    // get_interactive_elements: all links must have non-empty accessible names
    const links = page.getByRole('link');
    const count = await links.count();

    let emptyNameCount = 0;
    for (let i = 0; i < Math.min(count, 50); i++) {
      const link = links.nth(i);
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');
      if (!text?.trim() && !ariaLabel) {
        emptyNameCount++;
      }
    }

    // Warn if any links have no accessible text
    expect(emptyNameCount).toBe(0);
  });

  test('skip navigation link is present for keyboard users', async ({ page }) => {
    // WCAG 2.4.1: skip links allow keyboard users to bypass repeated content
    // Typically hidden until focused — Tab to the first focusable element
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    const href = await focused.getAttribute('href');
    // Skip link should target a main content anchor
    expect(href).toMatch(/^#/);
  });

  test('images have alt text', async ({ page }) => {
    // WCAG 1.1.1: non-decorative images must have alt text
    const images = page.locator('img');
    const count = await images.count();

    let missingAlt = 0;
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      // role="presentation" or role="none" with empty alt is valid for decorative images
      if (alt === null && role !== 'presentation' && role !== 'none') {
        missingAlt++;
      }
    }
    expect(missingAlt).toBe(0);
  });
});

test.describe('Accessibility Audit — GitHub Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('form inputs all have accessible labels', async ({ page }) => {
    // get_accessibility_tree confirmed: every input has a non-empty name
    const inputs = page.locator('input:not([type="hidden"]):not([type="submit"])');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      const id = await input.getAttribute('id');
      const hasForLabel =
        id !== null && (await page.locator(`label[for="${id}"]`).count()) > 0;

      expect(
        ariaLabel || ariaLabelledBy || hasForLabel,
        `Input #${i} (id="${id}") is missing an accessible label`
      ).toBeTruthy();
    }
  });

  test('submit button has accessible name', async ({ page }) => {
    // get_interactive_elements: button name="Sign in" — non-empty, clear intent
    const signIn = page.getByRole('button', { name: 'Sign in', exact: true });
    await expect(signIn).toBeVisible();

    const name = await signIn.textContent();
    expect(name?.trim().length).toBeGreaterThan(0);
  });

  test('error messages are announced to screen readers', async ({ page }) => {
    // After failed login, error must use role=alert (confirmed via get_accessibility_tree)
    await page.getByRole('textbox', { name: 'Username or email address' }).fill('bad@test.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('badpass');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    // role=alert is announced immediately by screen readers
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 10000 });
  });

  test('focus is trapped correctly within the form', async ({ page }) => {
    // keyboard navigation audit from get_focused_element sequence
    const username = page.getByRole('textbox', { name: 'Username or email address' });
    await username.focus();

    // Tab through all form elements — should not escape to browser chrome
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(focused).not.toBe('BODY'); // focus should never land on body
    }
  });
});
