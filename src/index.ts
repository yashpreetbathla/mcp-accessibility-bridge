import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { browserConnectSchema, browserConnectHandler } from './tools/browserConnect.js';
import { browserNavigateSchema, browserNavigateHandler } from './tools/browserNavigate.js';
import { browserDisconnectSchema, browserDisconnectHandler } from './tools/browserDisconnect.js';
import { getAccessibilityTreeSchema, getAccessibilityTreeHandler } from './tools/getAccessibilityTree.js';
import { queryAccessibilityTreeSchema, queryAccessibilityTreeHandler } from './tools/queryAccessibilityTree.js';
import { getElementPropertiesSchema, getElementPropertiesHandler } from './tools/getElementProperties.js';
import { getInteractiveElementsSchema, getInteractiveElementsHandler } from './tools/getInteractiveElements.js';
import { getFocusedElementSchema, getFocusedElementHandler } from './tools/getFocusedElement.js';

const server = new McpServer({
  name: 'mcp-accessibility-bridge',
  version: '1.0.0',
});

// ── browser_connect ──────────────────────────────────────────────────────────
server.registerTool(
  'browser_connect',
  {
    title: 'Connect to Chrome Browser',
    description:
      'Connect to a running Chrome browser via the Chrome DevTools Protocol (CDP). ' +
      'Chrome must be started with --remote-debugging-port=9222. ' +
      'Command: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome ' +
      '--remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-profile',
    inputSchema: browserConnectSchema,
  },
  browserConnectHandler
);

// ── browser_navigate ─────────────────────────────────────────────────────────
server.registerTool(
  'browser_navigate',
  {
    title: 'Navigate to URL',
    description:
      'Navigate the connected browser to a URL. ' +
      'Returns the page title and HTTP status code when complete.',
    inputSchema: browserNavigateSchema,
  },
  browserNavigateHandler
);

// ── browser_disconnect ───────────────────────────────────────────────────────
server.registerTool(
  'browser_disconnect',
  {
    title: 'Disconnect from Chrome',
    description:
      'Close the CDP connection to Chrome. Does NOT kill the Chrome process. ' +
      'Call this when you are done to release the connection.',
    inputSchema: browserDisconnectSchema,
  },
  browserDisconnectHandler
);

// ── get_accessibility_tree ───────────────────────────────────────────────────
server.registerTool(
  'get_accessibility_tree',
  {
    title: 'Get Accessibility Tree',
    description:
      'Capture a snapshot of the current page\'s accessibility tree. ' +
      'Returns a hierarchical tree of ARIA roles, names, and properties. ' +
      'Use interestingOnly=false for the complete raw tree. ' +
      'Use useFullTree=true for the CDP-level complete tree (slower but more accurate). ' +
      'Use maxDepth to control how deep the tree goes.',
    inputSchema: getAccessibilityTreeSchema,
  },
  getAccessibilityTreeHandler
);

// ── query_accessibility_tree ─────────────────────────────────────────────────
server.registerTool(
  'query_accessibility_tree',
  {
    title: 'Query Accessibility Tree',
    description:
      'Search the accessibility tree by ARIA role and/or accessible name. ' +
      'Returns matching nodes with their properties. ' +
      'Example: role="button", accessibleName="Submit" finds all Submit buttons.',
    inputSchema: queryAccessibilityTreeSchema,
  },
  queryAccessibilityTreeHandler
);

// ── get_element_properties ───────────────────────────────────────────────────
server.registerTool(
  'get_element_properties',
  {
    title: 'Get Element Properties',
    description:
      'Given a CSS selector, returns the element\'s full accessibility properties ' +
      'and multi-framework test selectors (Playwright, Selenium, Cypress, WebdriverIO). ' +
      'Selectors are prioritized: data-testid > stable id > ARIA role > semantic CSS.',
    inputSchema: getElementPropertiesSchema,
  },
  getElementPropertiesHandler
);

// ── get_interactive_elements ─────────────────────────────────────────────────
server.registerTool(
  'get_interactive_elements',
  {
    title: 'Get Interactive Elements',
    description:
      'Find all interactive elements on the page (buttons, inputs, links, etc.) ' +
      'and return their accessibility info plus multi-framework test selectors. ' +
      'Covers 20 interactive ARIA roles. Use roles[] to filter to specific roles.',
    inputSchema: getInteractiveElementsSchema,
  },
  getInteractiveElementsHandler
);

// ── get_focused_element ──────────────────────────────────────────────────────
server.registerTool(
  'get_focused_element',
  {
    title: 'Get Focused Element',
    description:
      'Returns the currently keyboard-focused element\'s accessibility info ' +
      'and suggested selectors. Useful for checking focus management in accessible UIs.',
    inputSchema: getFocusedElementSchema,
  },
  getFocusedElementHandler
);

// ── Start server ─────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
