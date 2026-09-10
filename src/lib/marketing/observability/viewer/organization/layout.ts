import type { Edge, Node } from "@xyflow/react";

import type { MarketingOrganizationGraphModel } from "@/lib/marketing/observability/viewer/organization/overlay";
import type {
  MarketingOrganizationEdgeDef,
  MarketingOrganizationNodeDef,
} from "@/lib/marketing/observability/viewer/organization/topology";

/** Fixed layered layout — small org graph, no dagre/ELK. */
const COL = {
  left: 40,
  center: 320,
  right: 600,
  farRight: 880,
};

const ROW = {
  y0: 40,
  y1: 160,
  y2: 300,
  y3: 440,
  y4: 580,
  y5: 720,
  y6: 860,
  y7: 1000,
};

const POSITIONS: Record<string, { x: number; y: number }> = {
  human_owner: { x: COL.center, y: ROW.y0 },
  marketing_manager: { x: COL.center, y: ROW.y1 },
  research_intelligence: { x: COL.left, y: ROW.y1 },
  performance_analyst: { x: COL.farRight, y: ROW.y1 },
  deliverable_requirements: { x: COL.center, y: ROW.y2 },
  evidence_pack: { x: COL.center, y: ROW.y3 },
  content_strategist: { x: COL.center, y: ROW.y4 },
  creative_director: { x: COL.left, y: ROW.y4 },
  channel_producer: { x: COL.farRight, y: ROW.y4 },
  completeness_validator: { x: COL.center, y: ROW.y5 },
  governance_auditor: { x: COL.center, y: ROW.y6 },
  human_review: { x: COL.center, y: ROW.y7 },
  media_pipeline: { x: COL.farRight, y: ROW.y7 },
};

export type MarketingOrgFlowNodeData = {
  def: MarketingOrganizationNodeDef;
  overlay: MarketingOrganizationGraphModel["nodeOverlays"][string] | undefined;
  analytics: MarketingOrganizationGraphModel["stageAnalytics"][string] | undefined;
  selected: boolean;
};

export function toReactFlowElements(
  model: MarketingOrganizationGraphModel,
  selectedNodeId: string | null,
): { nodes: Node<MarketingOrgFlowNodeData>[]; edges: Edge[] } {
  const nodes: Node<MarketingOrgFlowNodeData>[] = model.nodes.map((def) => {
    const pos = POSITIONS[def.id] ?? { x: COL.center, y: ROW.y0 };
    return {
      id: def.id,
      type: "marketingOrg",
      position: pos,
      data: {
        def,
        overlay: model.nodeOverlays[def.id],
        analytics: model.stageAnalytics[def.id],
        selected: def.id === selectedNodeId,
      },
      draggable: false,
      selectable: true,
    };
  });

  const edges: Edge[] = model.edges.map((edge) => toFlowEdge(edge, model));
  return { nodes, edges };
}

function toFlowEdge(edge: MarketingOrganizationEdgeDef, model: MarketingOrganizationGraphModel): Edge {
  const visit = model.edgeOverlays[edge.id]?.visit ?? "not_yet";
  const isReports = edge.kind === "reports_to";
  const isPlanned = Boolean(edge.planned) || edge.kind === "optional_handoff";

  let stroke = "var(--border)";
  let strokeWidth = 1.5;
  let strokeDasharray: string | undefined;
  let animated = false;

  if (isPlanned) {
    strokeDasharray = "4 4";
    stroke = "var(--text-secondary)";
  } else if (isReports) {
    strokeDasharray = "2 6";
    stroke = "var(--text-secondary)";
    strokeWidth = 1;
  } else if (visit === "visited") {
    stroke = "#059669";
    strokeWidth = 2;
  } else if (visit === "active") {
    stroke = "#0284c7";
    strokeWidth = 2.5;
    animated = true;
  }

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    animated: animated && !isReports && !isPlanned,
    label: edge.label,
    style: { stroke, strokeWidth, strokeDasharray },
    labelStyle: { fill: "var(--text-secondary)", fontSize: 10 },
    data: { kind: edge.kind, visit, planned: edge.planned },
  };
}
