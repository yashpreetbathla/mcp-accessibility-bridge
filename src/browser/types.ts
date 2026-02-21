// CDP Accessibility node as returned by Accessibility.getFullAXTree / getPartialAXTree
export interface CdpAXValue {
  type: string;
  value?: unknown;
  relatedNodes?: CdpAXRelatedNode[];
}

export interface CdpAXRelatedNode {
  backendDOMNodeId?: number;
  idref?: string;
  text?: string;
}

export interface CdpAXProperty {
  name: string;
  value: CdpAXValue;
}

export interface CdpAXNode {
  nodeId: string;
  ignored: boolean;
  ignoredReasons?: CdpAXProperty[];
  role?: CdpAXValue;
  name?: CdpAXValue;
  description?: CdpAXValue;
  value?: CdpAXValue;
  properties?: CdpAXProperty[];
  parentId?: string;
  childIds?: string[];
  backendDOMNodeId?: number;
  frameId?: string;
}

// Accessibility.getFullAXTree response
export interface GetFullAXTreeResponse {
  nodes: CdpAXNode[];
}

// Accessibility.getPartialAXTree response
export interface GetPartialAXTreeResponse {
  nodes: CdpAXNode[];
}

// Accessibility.queryAXTree response
export interface QueryAXTreeResponse {
  nodes: CdpAXNode[];
}

// DOM.describeNode response
export interface DomDescribeNodeResponse {
  node: {
    nodeId: number;
    backendNodeId: number;
    nodeType: number;
    nodeName: string;
    localName: string;
    nodeValue: string;
    attributes?: string[];
    frameId?: string;
  };
}

// DOM.getOuterHTML response
export interface DomGetOuterHtmlResponse {
  outerHTML: string;
}

// Summarized AX node used in tool responses
export interface AXNodeSummary {
  role: string;
  name: string;
  description?: string;
  value?: string;
  focused?: boolean;
  disabled?: boolean;
  checked?: boolean | 'mixed';
  expanded?: boolean;
  required?: boolean;
  level?: number;
  backendDOMNodeId?: number;
  nodeId: string;
  children?: AXNodeSummary[];
}
