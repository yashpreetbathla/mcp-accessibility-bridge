import { browserManager } from '../browser/BrowserManager.js';
import { toolError, toolSuccess } from '../utils/errors.js';
import { findNode } from '../utils/axTree.js';
import { buildSelectorFromRawNode } from '../utils/selectorGenerator.js';
import type {
  DomDescribeNodeResponse,
  GetPartialAXTreeResponse,
} from '../browser/types.js';

export const getFocusedElementSchema = {};

export async function getFocusedElementHandler(
  _args: Record<string, never>
): Promise<ReturnType<typeof toolSuccess | typeof toolError>> {
  try {
    const { page, cdpSession } = browserManager.requireConnection();

    // Snapshot the full AX tree (unfiltered) to find focused node
    const snapshot = await page.accessibility.snapshot({ interestingOnly: false });

    if (!snapshot) {
      return toolSuccess({
        focused: null,
        message: 'No accessibility snapshot available.',
      });
    }

    // Find the focused node via the snapshot
    // Puppeteer's snapshot returns plain objects; we need to walk the tree
    const focusedNode = findFocusedInSnapshot(snapshot as unknown as Record<string, unknown>);

    if (!focusedNode) {
      return toolSuccess({
        focused: null,
        message: 'No element is currently focused.',
      });
    }

    // Try to get additional selector info via CDP
    // Use DOM.getFocusedNodeDetails if available, otherwise use JS evaluation
    let suggestedSelectors = null;
    let domAttributes: Record<string, string> | null = null;
    let tagName: string | null = null;

    try {
      // Get focused element via JavaScript
      const focusedHandle = await page.evaluateHandle(() => document.activeElement);
      const remoteObj = focusedHandle.remoteObject();

      if (remoteObj.objectId) {
        const describeResult = await cdpSession.send('DOM.describeNode', {
          objectId: remoteObj.objectId,
          depth: 0,
        }) as DomDescribeNodeResponse;

        const domNode = describeResult.node;
        tagName = domNode.localName;
        domAttributes = parseAttributes(domNode.attributes);

        // Get AX tree for this specific node
        const axResult = await cdpSession.send('Accessibility.getPartialAXTree', {
          backendNodeId: domNode.backendNodeId,
          fetchRelatives: false,
        }) as GetPartialAXTreeResponse;

        const primaryAXNode = (axResult.nodes ?? []).find((n) => !n.ignored);
        if (primaryAXNode) {
          const name = (primaryAXNode.name?.value as string) ?? '';
          const role = (primaryAXNode.role?.value as string) ?? '';
          suggestedSelectors = buildSelectorFromRawNode(
            name,
            role,
            tagName,
            domNode.attributes
          );
        }
      }
    } catch {
      // DOM info unavailable — still return what we have from the snapshot
    }

    return toolSuccess({
      focused: {
        role: focusedNode['role'] as string,
        name: focusedNode['name'] as string,
        ...(focusedNode['value'] !== undefined && { value: focusedNode['value'] }),
        ...(focusedNode['description'] !== undefined && { description: focusedNode['description'] }),
        ...(tagName && { tagName }),
        ...(domAttributes && { domAttributes }),
        ...(suggestedSelectors && { suggestedSelectors }),
      },
    });
  } catch (error) {
    return toolError(error);
  }
}

function findFocusedInSnapshot(
  node: Record<string, unknown>
): Record<string, unknown> | null {
  if (node['focused'] === true) return node;

  const children = node['children'] as Record<string, unknown>[] | undefined;
  if (!children) return null;

  for (const child of children) {
    const found = findFocusedInSnapshot(child);
    if (found) return found;
  }
  return null;
}

function parseAttributes(attrs: string[] | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!attrs) return map;
  for (let i = 0; i + 1 < attrs.length; i += 2) {
    map[attrs[i]] = attrs[i + 1];
  }
  return map;
}
