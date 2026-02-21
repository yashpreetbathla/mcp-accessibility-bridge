import { z } from 'zod';
import { browserManager } from '../browser/BrowserManager.js';
import { toolError, toolSuccess } from '../utils/errors.js';
import { cdpAXNodeToSummary } from '../utils/axTree.js';
import { buildSelectorFromRawNode } from '../utils/selectorGenerator.js';
import type {
  DomDescribeNodeResponse,
  DomGetOuterHtmlResponse,
  GetPartialAXTreeResponse,
} from '../browser/types.js';

export const getElementPropertiesSchema = {
  selector: z
    .string()
    .describe('CSS selector to identify the element (e.g. "input[type=search]", "#submit-btn").'),
  includeHtml: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include the outer HTML of the element. Default: false'),
};

export async function getElementPropertiesHandler(args: {
  selector: string;
  includeHtml?: boolean;
}): Promise<ReturnType<typeof toolSuccess | typeof toolError>> {
  try {
    const { page, cdpSession } = browserManager.requireConnection();

    // 1. Find the element via CSS selector
    const element = await page.$(args.selector);
    if (!element) {
      return toolError(
        `No element found matching selector: "${args.selector}"`
      );
    }

    // 2. Get the backend node ID via DOM.describeNode
    const nodeInfo = element.remoteObject();
    const describeResult = await cdpSession.send('DOM.describeNode', {
      objectId: nodeInfo.objectId,
      depth: 0,
    }) as DomDescribeNodeResponse;

    const domNode = describeResult.node;
    const backendNodeId = domNode.backendNodeId;
    const tagName = domNode.localName;
    const rawAttributes = domNode.attributes;

    // 3. Get the accessibility tree for this specific node
    const axResult = await cdpSession.send('Accessibility.getPartialAXTree', {
      backendNodeId,
      fetchRelatives: false,
    }) as GetPartialAXTreeResponse;

    const axNodes = axResult.nodes ?? [];
    const primaryAXNode = axNodes.find((n) => !n.ignored) ?? axNodes[0];

    let axSummary = null;
    let suggestedSelectors = null;

    if (primaryAXNode) {
      axSummary = cdpAXNodeToSummary(primaryAXNode);
      const name = (primaryAXNode.name?.value as string) ?? '';
      const role = (primaryAXNode.role?.value as string) ?? '';
      suggestedSelectors = buildSelectorFromRawNode(name, role, tagName, rawAttributes);
    }

    // 4. Optionally get outer HTML
    let outerHTML: string | undefined;
    if (args.includeHtml) {
      try {
        const htmlResult = await cdpSession.send('DOM.getOuterHTML', {
          backendNodeId,
        }) as DomGetOuterHtmlResponse;
        outerHTML = htmlResult.outerHTML;
      } catch {
        outerHTML = undefined;
      }
    }

    return toolSuccess({
      selector: args.selector,
      tagName,
      domAttributes: parseAttributes(rawAttributes),
      backendNodeId,
      accessibility: axSummary,
      suggestedSelectors,
      ...(outerHTML !== undefined && { outerHTML }),
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
