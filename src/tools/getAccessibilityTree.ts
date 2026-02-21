import { z } from 'zod';
import { browserManager } from '../browser/BrowserManager.js';
import { toolError, toolSuccess } from '../utils/errors.js';
import {
  buildTreeIndex,
  assembleTree,
  pruneToDepth,
  countNodes,
  cdpAXNodeToSummary,
} from '../utils/axTree.js';
import type { CdpAXNode, GetFullAXTreeResponse } from '../browser/types.js';

export const getAccessibilityTreeSchema = {
  interestingOnly: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'If true, prunes nodes that are not interesting (hidden, presentational). ' +
      'Set false to get the raw full tree. Default: true'
    ),
  maxDepth: z
    .number()
    .int()
    .positive()
    .optional()
    .default(10)
    .describe('Maximum tree depth to return. Default: 10'),
  useFullTree: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'If true, uses CDP Accessibility.getFullAXTree (more complete but slower). ' +
      'If false, uses page.accessibility.snapshot(). Default: false'
    ),
};

export async function getAccessibilityTreeHandler(args: {
  interestingOnly?: boolean;
  maxDepth?: number;
  useFullTree?: boolean;
}): Promise<ReturnType<typeof toolSuccess | typeof toolError>> {
  try {
    const { page, cdpSession } = browserManager.requireConnection();

    const interestingOnly = args.interestingOnly ?? true;
    const maxDepth = args.maxDepth ?? 10;
    const useFullTree = args.useFullTree ?? false;

    let tree: unknown;
    let nodeCount = 0;

    if (useFullTree) {
      // Use CDP Accessibility.getFullAXTree for the raw complete tree
      const result = await cdpSession.send(
        'Accessibility.getFullAXTree',
        {}
      ) as GetFullAXTreeResponse;

      const nodes: CdpAXNode[] = result.nodes;
      const filtered = interestingOnly
        ? nodes.filter((n) => !n.ignored)
        : nodes;

      // Find root node (no parentId or parentId not in set)
      const nodeIds = new Set(filtered.map((n) => n.nodeId));
      const root = filtered.find((n) => !n.parentId || !nodeIds.has(n.parentId));

      if (!root) {
        return toolSuccess({
          tree: null,
          nodeCount: 0,
          message: 'No root node found in accessibility tree.',
        });
      }

      const index = buildTreeIndex(filtered);
      const assembled = assembleTree(root, index, 0, maxDepth);
      tree = pruneToDepth(assembled, maxDepth);
      nodeCount = countNodes(assembled);
    } else {
      // Use Puppeteer's higher-level accessibility snapshot
      const snapshot = await page.accessibility.snapshot({
        interestingOnly,
      });

      if (!snapshot) {
        return toolSuccess({
          tree: null,
          nodeCount: 0,
          message: 'Accessibility snapshot returned null. The page may not have loaded.',
        });
      }

      tree = snapshot;
      // Count nodes in the snapshot
      nodeCount = countSnapshotNodes(snapshot as unknown as Record<string, unknown>);
    }

    const title = await page.title().catch(() => '');
    const url = page.url();

    return toolSuccess({
      url,
      title,
      nodeCount,
      maxDepth,
      interestingOnly,
      tree,
    });
  } catch (error) {
    return toolError(error);
  }
}

function countSnapshotNodes(node: Record<string, unknown>): number {
  const children = node['children'] as Record<string, unknown>[] | undefined;
  if (!children || children.length === 0) return 1;
  return 1 + children.reduce((sum, child) => sum + countSnapshotNodes(child), 0);
}
