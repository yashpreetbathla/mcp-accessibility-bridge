import { z } from 'zod';
import { browserManager } from '../browser/BrowserManager.js';
import { toolError, toolSuccess } from '../utils/errors.js';
import { cdpAXNodeToSummary } from '../utils/axTree.js';
import { buildSelectorFromRawNode } from '../utils/selectorGenerator.js';
import type {
  CdpAXNode,
  GetFullAXTreeResponse,
  DomDescribeNodeResponse,
} from '../browser/types.js';

const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'searchbox',
  'combobox',
  'listbox',
  'option',
  'checkbox',
  'radio',
  'switch',
  'slider',
  'spinbutton',
  'menuitem',
  'tab',
  'treeitem',
  'gridcell',
  'rowheader',
  'columnheader',
  'progressbar',
  'scrollbar',
]);

export const getInteractiveElementsSchema = {
  roles: z
    .array(z.string())
    .optional()
    .describe(
      'Specific ARIA roles to include. Defaults to all 20 interactive roles: ' +
      'button, link, textbox, searchbox, combobox, listbox, option, checkbox, radio, ' +
      'switch, slider, spinbutton, menuitem, tab, treeitem, gridcell, rowheader, ' +
      'columnheader, progressbar, scrollbar'
    ),
  includeDisabled: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include disabled elements. Default: false'),
  maxElements: z
    .number()
    .int()
    .positive()
    .optional()
    .default(100)
    .describe('Maximum number of elements to return. Default: 100'),
};

interface ElementResult {
  role: string;
  name: string;
  nodeId: string;
  backendDOMNodeId?: number;
  tagName?: string;
  domAttributes?: Record<string, string>;
  suggestedSelectors?: ReturnType<typeof buildSelectorFromRawNode>;
  axProperties?: ReturnType<typeof cdpAXNodeToSummary>;
}

export async function getInteractiveElementsHandler(args: {
  roles?: string[];
  includeDisabled?: boolean;
  maxElements?: number;
}): Promise<ReturnType<typeof toolSuccess | typeof toolError>> {
  try {
    const { cdpSession } = browserManager.requireConnection();

    const targetRoles = args.roles
      ? new Set(args.roles.map((r) => r.toLowerCase()))
      : INTERACTIVE_ROLES;

    const includeDisabled = args.includeDisabled ?? false;
    const maxElements = args.maxElements ?? 100;

    // Get full AX tree
    const result = await cdpSession.send(
      'Accessibility.getFullAXTree',
      {}
    ) as GetFullAXTreeResponse;

    const allNodes: CdpAXNode[] = result.nodes;

    // Filter to interactive roles
    const interactiveNodes = allNodes.filter((node) => {
      if (node.ignored) return false;

      const role = (node.role?.value as string ?? '').toLowerCase();
      if (!targetRoles.has(role)) return false;

      // Skip disabled unless requested
      if (!includeDisabled) {
        const props = node.properties ?? [];
        const disabledProp = props.find((p) => p.name === 'disabled');
        if (disabledProp?.value?.value === true) return false;
      }

      return true;
    });

    const limited = interactiveNodes.slice(0, maxElements);

    // Resolve DOM info for each node in parallel
    const elementResults = await Promise.all(
      limited.map(async (node): Promise<ElementResult> => {
        const axSummary = cdpAXNodeToSummary(node);
        const role = (node.role?.value as string) ?? '';
        const name = (node.name?.value as string) ?? '';

        const base: ElementResult = {
          role,
          name,
          nodeId: node.nodeId,
          backendDOMNodeId: node.backendDOMNodeId,
          axProperties: axSummary,
        };

        if (!node.backendDOMNodeId) {
          return {
            ...base,
            suggestedSelectors: buildSelectorFromRawNode(name, role, 'unknown', undefined),
          };
        }

        try {
          const describeResult = await cdpSession.send('DOM.describeNode', {
            backendNodeId: node.backendDOMNodeId,
            depth: 0,
          }) as DomDescribeNodeResponse;

          const domNode = describeResult.node;
          const tagName = domNode.localName;
          const rawAttrs = domNode.attributes;
          const domAttributes = parseAttributes(rawAttrs);

          return {
            ...base,
            tagName,
            domAttributes,
            suggestedSelectors: buildSelectorFromRawNode(name, role, tagName, rawAttrs),
          };
        } catch {
          // DOM.describeNode can fail for some nodes (e.g. detached)
          return {
            ...base,
            suggestedSelectors: buildSelectorFromRawNode(name, role, 'unknown', undefined),
          };
        }
      })
    );

    return toolSuccess({
      totalFound: interactiveNodes.length,
      returned: elementResults.length,
      maxElements,
      roles: [...targetRoles],
      elements: elementResults,
    });
  } catch (error) {
    return toolError(error);
  }
}

function parseAttributes(attrs: string[] | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!attrs) return map;
  for (let i = 0; i + 1 < attrs.length; i += 2) {
    map[attrs[i]] = attrs[i + 1];
  }
  return map;
}
