export interface SuggestedSelectors {
  testId?: string;
  id?: string;
  aria?: string;
  css?: string;
  playwright?: string;
  selenium?: string;
  cypress?: string;
  webdriverio?: string;
  stability: 'high' | 'medium' | 'low';
  recommended: string;
}

// Attribute names we extract from the flat attributes array
const TEST_ID_ATTRS = ['data-testid', 'data-cy', 'data-test', 'data-qa'];

// IDs that should be considered unstable and skipped
const UNSTABLE_ID_RE = /^(mat-|ng-|[0-9]|[a-f0-9]{8}-)/i;

/**
 * Parse a flat attributes array ["key", "value", "key", "value", ...] into a map.
 */
function parseAttrs(attributes: string[] | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!attributes) return map;
  for (let i = 0; i + 1 < attributes.length; i += 2) {
    map[attributes[i]] = attributes[i + 1];
  }
  return map;
}

/**
 * Build multi-framework selectors from an AX node's raw DOM attributes.
 *
 * Priority:
 *   1. data-testid / data-cy / data-test / data-qa  →  high stability
 *   2. Stable id (not UUID / numeric / mat- / ng-)  →  high stability
 *   3. role + accessible name                        →  medium stability
 *   4. Semantic CSS (tagName + type/name attrs)      →  medium stability
 */
export function buildSelectorFromRawNode(
  name: string,
  role: string,
  tagName: string,
  attributes: string[] | undefined,
): SuggestedSelectors {
  const attrs = parseAttrs(attributes);
  const tag = tagName.toLowerCase();

  // --- Priority 1: test ID attributes ---
  for (const attr of TEST_ID_ATTRS) {
    const val = attrs[attr];
    if (val) {
      const attrSelector = `[${attr}="${val}"]`;
      const attrName = attr === 'data-testid' ? val : undefined;
      return {
        testId: attrSelector,
        aria: buildAriaSelector(role, name),
        css: attrSelector,
        playwright: attr === 'data-testid'
          ? `page.getByTestId('${escapeStr(val)}')`
          : `page.locator('[${attr}="${escapeStr(val)}"]')`,
        selenium: `driver.find_element(By.CSS_SELECTOR, '${attrSelector}')`,
        cypress: `cy.get('${attrSelector}')`,
        webdriverio: `$('${attrSelector}')`,
        stability: 'high',
        recommended: attr === 'data-testid'
          ? `page.getByTestId('${escapeStr(val)}')`
          : `page.locator('[${attr}="${escapeStr(val)}"]')`,
      };
    }
  }

  // --- Priority 2: Stable id ---
  const idVal = attrs['id'];
  if (idVal && !UNSTABLE_ID_RE.test(idVal)) {
    const idSelector = `#${idVal}`;
    return {
      id: idSelector,
      aria: buildAriaSelector(role, name),
      css: idSelector,
      playwright: `page.locator('${idSelector}')`,
      selenium: `driver.find_element(By.ID, '${escapeStr(idVal)}')`,
      cypress: `cy.get('${idSelector}')`,
      webdriverio: `$('${idSelector}')`,
      stability: 'high',
      recommended: `page.locator('${idSelector}')`,
    };
  }

  // --- Priority 3: ARIA role + accessible name ---
  if (name && role) {
    const ariaSelector = buildAriaSelector(role, name);
    const playwrightByRole = buildPlaywrightByRole(role, name);
    const xpathSelector = buildXPath(role, name, tag);
    return {
      aria: ariaSelector,
      css: buildSemanticCss(tag, attrs),
      playwright: playwrightByRole,
      selenium: `driver.find_element(By.XPATH, '${xpathSelector}')`,
      cypress: `cy.get('${buildSemanticCss(tag, attrs) || tag}')`,
      webdriverio: `$('${ariaSelector}')`,
      stability: 'medium',
      recommended: playwrightByRole,
    };
  }

  // --- Priority 4: Semantic CSS ---
  const semanticCss = buildSemanticCss(tag, attrs) || tag;
  return {
    css: semanticCss,
    playwright: `page.locator('${semanticCss}')`,
    selenium: `driver.find_element(By.CSS_SELECTOR, '${semanticCss}')`,
    cypress: `cy.get('${semanticCss}')`,
    webdriverio: `$('${semanticCss}')`,
    stability: 'low',
    recommended: `page.locator('${semanticCss}')`,
  };
}

function buildAriaSelector(role: string, name: string): string {
  if (!name) return `role=${role}`;
  return `role=${role}[name='${escapeStr(name)}']`;
}

function buildPlaywrightByRole(role: string, name: string): string {
  // Map CDP AX roles to Playwright ARIA roles
  const roleMap: Record<string, string> = {
    textbox: 'textbox',
    searchbox: 'searchbox',
    combobox: 'combobox',
    button: 'button',
    link: 'link',
    checkbox: 'checkbox',
    radio: 'radio',
    listbox: 'listbox',
    option: 'option',
    menuitem: 'menuitem',
    tab: 'tab',
    switch: 'switch',
    slider: 'slider',
    spinbutton: 'spinbutton',
    gridcell: 'gridcell',
  };

  const ariaRole = roleMap[role] ?? role;

  if (!name) {
    return `page.getByRole('${escapeStr(ariaRole)}')`;
  }
  return `page.getByRole('${escapeStr(ariaRole)}', { name: '${escapeStr(name)}' })`;
}

function buildXPath(role: string, name: string, tag: string): string {
  if (name) {
    return `//${tag}[@aria-label='${escapeStr(name)}' or @title='${escapeStr(name)}']`;
  }
  return `//${tag}[@role='${role}']`;
}

function buildSemanticCss(tag: string, attrs: Record<string, string>): string {
  const parts: string[] = [tag];
  const useful = ['type', 'name', 'role', 'placeholder'];
  for (const attr of useful) {
    if (attrs[attr]) {
      parts.push(`[${attr}="${attrs[attr]}"]`);
    }
  }
  return parts.join('');
}

function escapeStr(s: string): string {
  return s.replace(/'/g, "\\'").replace(/"/g, '\\"');
}
