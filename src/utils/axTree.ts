import type { CdpAXNode, CdpAXProperty, AXNodeSummary } from '../browser/types.js';

/**
 * Convert a CDP AX property value to a plain JS value.
 */
function getPropertyValue(props: CdpAXProperty[] | undefined, name: string): unknown {
  if (!props) return undefined;
  const prop = props.find((p) => p.name === name);
  return prop?.value?.value;
}

/**
 * Convert a raw CdpAXNode into a cleaner AXNodeSummary.
 */
export function cdpAXNodeToSummary(node: CdpAXNode): AXNodeSummary {
  const role = (node.role?.value as string) ?? 'unknown';
  const name = (node.name?.value as string) ?? '';
  const description = node.description?.value as string | undefined;
  const value = node.value?.value as string | undefined;

  const props = node.properties ?? [];
  const focused = getPropertyValue(props, 'focused') as boolean | undefined;
  const disabled = getPropertyValue(props, 'disabled') as boolean | undefined;
  const checked = getPropertyValue(props, 'checked') as boolean | 'mixed' | undefined;
  const expanded = getPropertyValue(props, 'expanded') as boolean | undefined;
  const required = getPropertyValue(props, 'required') as boolean | undefined;
  const level = getPropertyValue(props, 'level') as number | undefined;

  return {
    role,
    name,
    ...(description !== undefined && { description }),
    ...(value !== undefined && { value }),
    ...(focused !== undefined && { focused }),
    ...(disabled !== undefined && { disabled }),
    ...(checked !== undefined && { checked }),
    ...(expanded !== undefined && { expanded }),
    ...(required !== undefined && { required }),
    ...(level !== undefined && { level }),
    ...(node.backendDOMNodeId !== undefined && { backendDOMNodeId: node.backendDOMNodeId }),
    nodeId: node.nodeId,
  };
}

/**
 * Build an index of nodeId → CdpAXNode for fast lookups.
 */
export function buildTreeIndex(nodes: CdpAXNode[]): Map<string, CdpAXNode> {
  const index = new Map<string, CdpAXNode>();
  for (const node of nodes) {
    index.set(node.nodeId, node);
  }
  return index;
}

/**
 * Recursively assemble an AXNodeSummary tree from the flat CDP node list.
 * Returns the root node summary with children attached.
 */
export function assembleTree(
  node: CdpAXNode,
  index: Map<string, CdpAXNode>,
  depth: number,
  maxDepth: number,
): AXNodeSummary {
  const summary = cdpAXNodeToSummary(node);

  if (depth >= maxDepth || !node.childIds || node.childIds.length === 0) {
    return summary;
  }

  const children: AXNodeSummary[] = [];
  for (const childId of node.childIds) {
    const child = index.get(childId);
    if (child && !child.ignored) {
      children.push(assembleTree(child, index, depth + 1, maxDepth));
    }
  }

  if (children.length > 0) {
    summary.children = children;
  }

  return summary;
}

/**
 * Prune a tree to a maximum depth, returning at most maxDepth levels.
 * depth=1 means only the root node, depth=2 includes root + its children, etc.
 */
export function pruneToDepth(node: AXNodeSummary, maxDepth: number): AXNodeSummary {
  if (maxDepth <= 1 || !node.children) {
    const { children: _children, ...rest } = node;
    return rest as AXNodeSummary;
  }

  return {
    ...node,
    children: node.children.map((child) => pruneToDepth(child, maxDepth - 1)),
  };
}

/**
 * Count total nodes in a tree.
 */
export function countNodes(node: AXNodeSummary): number {
  if (!node.children || node.children.length === 0) return 1;
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}

/**
 * Find the first node matching a predicate via DFS.
 */
export function findNode(
  node: AXNodeSummary,
  predicate: (n: AXNodeSummary) => boolean,
): AXNodeSummary | null {
  if (predicate(node)) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNode(child, predicate);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Find all nodes matching a predicate via DFS.
 */
export function findAllNodes(
  node: AXNodeSummary,
  predicate: (n: AXNodeSummary) => boolean,
): AXNodeSummary[] {
  const results: AXNodeSummary[] = [];
  if (predicate(node)) results.push(node);
  if (node.children) {
    for (const child of node.children) {
      results.push(...findAllNodes(child, predicate));
    }
  }
  return results;
}
