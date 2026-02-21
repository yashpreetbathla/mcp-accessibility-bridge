import { z } from 'zod';
import { browserManager } from '../browser/BrowserManager.js';
import { toolError, toolSuccess } from '../utils/errors.js';
import { cdpAXNodeToSummary } from '../utils/axTree.js';
import type { QueryAXTreeResponse } from '../browser/types.js';

export const queryAccessibilityTreeSchema = {
  role: z
    .string()
    .optional()
    .describe(
      'ARIA role to filter by (e.g. "button", "textbox", "link", "heading"). ' +
      'Case-insensitive.'
    ),
  accessibleName: z
    .string()
    .optional()
    .describe('Accessible name to match (partial or exact). Case-insensitive.'),
  backendNodeId: z
    .number()
    .int()
    .optional()
    .describe('DOM backend node ID to start search from (narrows scope).'),
};

export async function queryAccessibilityTreeHandler(args: {
  role?: string;
  accessibleName?: string;
  backendNodeId?: number;
}): Promise<ReturnType<typeof toolSuccess | typeof toolError>> {
  try {
    const { cdpSession } = browserManager.requireConnection();

    if (!args.role && !args.accessibleName) {
      return toolError(
        'At least one of "role" or "accessibleName" must be provided.'
      );
    }

    const params: Record<string, unknown> = {};
    if (args.role) params['role'] = args.role;
    if (args.accessibleName) params['accessibleName'] = args.accessibleName;
    if (args.backendNodeId !== undefined) params['backendNodeId'] = args.backendNodeId;

    const result = await cdpSession.send(
      'Accessibility.queryAXTree',
      params
    ) as QueryAXTreeResponse;

    const nodes = result.nodes ?? [];
    const summaries = nodes
      .filter((n) => !n.ignored)
      .map(cdpAXNodeToSummary);

    return toolSuccess({
      query: {
        role: args.role,
        accessibleName: args.accessibleName,
        backendNodeId: args.backendNodeId,
      },
      count: summaries.length,
      nodes: summaries,
    });
  } catch (error) {
    return toolError(error);
  }
}
