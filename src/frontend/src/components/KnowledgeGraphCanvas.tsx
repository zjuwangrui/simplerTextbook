import cytoscape, { Core, ElementDefinition } from "cytoscape";
import { useEffect, useMemo, useRef, useState } from "react";

import { GraphData, GraphEdge, GraphNode } from "../types";

interface KnowledgeGraphCanvasProps {
  graph: GraphData | null;
}

type CytoscapeStyle = cytoscape.CytoscapeOptions["style"];

const SOURCE_PALETTE = [
  "#1d4ed8",
  "#0f766e",
  "#c2410c",
  "#7c3aed",
  "#be123c",
  "#0369a1",
  "#65a30d",
  "#b45309"
];

const CATEGORY_COLORS: Record<string, string> = {
  section: "#0f766e",
  keyword: "#f97316",
  textbook: "#0f172a",
  "shared-keyword": "#0891b2",
  "unique-keyword": "#ca8a04",
  "核心概念": "#1d4ed8",
  "关键条件": "#7c3aed",
  "方法": "#0f766e",
  "定理": "#be123c",
  "现象": "#ea580c",
  "机制": "#0369a1",
  "应用场景": "#65a30d",
  "设计方法": "#0f766e",
  "设计技术": "#0ea5e9",
  "原型滤波器": "#a21caf"
};

export function KnowledgeGraphCanvas({ graph }: KnowledgeGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const sourceTextbooks = useMemo(() => collectSourceTextbooks(graph), [graph]);
  const sourceColorMap = useMemo(() => {
    const mapping: Record<string, string> = {};
    sourceTextbooks.forEach((source, index) => {
      mapping[source] = SOURCE_PALETTE[index % SOURCE_PALETTE.length];
    });
    return mapping;
  }, [sourceTextbooks]);

  useEffect(() => {
    if (!containerRef.current || !graph || graph.nodes.length === 0) {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
      return;
    }

    const elements = buildElements(graph, sourceColorMap);
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      layout: {
        name: "cose",
        animate: false,
        padding: 40,
        fit: true
      },
      wheelSensitivity: 0.18,
      minZoom: 0.35,
      maxZoom: 2.4,
      style: buildStyles()
    });

    cy.on("tap", "node", (event) => {
      const nodeData = event.target.data("raw") as GraphNode;
      setSelectedNode(nodeData);
    });

    cy.on("tap", (event) => {
      if (event.target === cy) {
        setSelectedNode(null);
      }
    });

    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [graph, sourceColorMap]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    const keyword = searchTerm.trim().toLowerCase();
    cy.elements().removeClass("dimmed");
    cy.elements().removeClass("highlighted");

    if (!keyword) {
      return;
    }

    const matchedNodes = cy.nodes().filter((node) => {
      const name = String(node.data("name") ?? "").toLowerCase();
      const definition = String(node.data("definition") ?? "").toLowerCase();
      return name.includes(keyword) || definition.includes(keyword);
    });

    if (matchedNodes.length === 0) {
      cy.elements().addClass("dimmed");
      return;
    }

    cy.elements().addClass("dimmed");
    matchedNodes.removeClass("dimmed");
    matchedNodes.addClass("highlighted");
    matchedNodes.connectedEdges().removeClass("dimmed").addClass("highlighted");
    matchedNodes.connectedEdges().connectedNodes().removeClass("dimmed");
    cy.fit(matchedNodes.union(matchedNodes.connectedEdges()), 80);
  }, [searchTerm]);

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="graph-empty">
        <p>上传教材或切换图谱视图后，这里会展示知识图谱。</p>
      </div>
    );
  }

  return (
    <div className="interactive-graph-shell">
      <div className="graph-toolbar">
        <input
          className="graph-search-input"
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="搜索知识点，支持名称或定义关键词"
          type="search"
          value={searchTerm}
        />
        <div className="graph-legend">
          {sourceTextbooks.map((source) => (
            <span className="legend-item" key={source}>
              <i style={{ backgroundColor: sourceColorMap[source] }} />
              {source}
            </span>
          ))}
        </div>
      </div>

      <div className="graph-main-layout">
        <div className="cytoscape-canvas" ref={containerRef} />
      </div>

      <aside className="graph-detail-panel graph-detail-panel-below">
        {selectedNode ? (
          <>
            <h3>{selectedNode.name ?? selectedNode.label}</h3>
            <p>{selectedNode.definition ?? "暂无定义。"}</p>
            <div className="detail-badges">
              {selectedNode.category ? <span>{selectedNode.category}</span> : null}
              {selectedNode.page ? <span>页码: {selectedNode.page}</span> : null}
              {selectedNode.frequency ? <span>频次: {selectedNode.frequency}</span> : null}
            </div>
            <div className="detail-section">
              <strong>所在章节</strong>
              <p>{selectedNode.chapter ?? selectedNode.chapters?.join("、") ?? "未知章节"}</p>
            </div>
            <div className="detail-section">
              <strong>教材来源</strong>
              <p>{selectedNode.source_textbooks?.join("、") ?? "未知来源"}</p>
            </div>
            <div className="detail-section">
              <strong>原文出处</strong>
              <div className="mention-list">
                {(selectedNode.mentions ?? []).slice(0, 8).map((mention, index) => (
                  <div className="mention-item" key={`${mention.source_temp_id}-${index}`}>
                    <span>{mention.textbook_title ?? "当前教材"}</span>
                    <span>{mention.chapter}</span>
                    <span>第 {mention.page} 页</span>
                  </div>
                ))}
                {(selectedNode.mentions ?? []).length === 0 ? (
                  <p className="empty-state">当前节点没有可展示的出处记录。</p>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <>
            <h3>节点详情</h3>
            <p>点击任意节点后，这里会展示知识点名称、定义、章节和原文出处。</p>
            <div className="detail-section">
              <strong>交互说明</strong>
              <p>支持滚轮缩放、拖动画布、拖动节点以及关键词搜索高亮。</p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function buildElements(graph: GraphData, sourceColorMap: Record<string, string>): ElementDefinition[] {
  const nodes = graph.nodes.map((node) => buildNodeElement(node, sourceColorMap));
  const edges = graph.edges.map((edge, index) => buildEdgeElement(edge, index));
  return [...nodes, ...edges];
}

function buildNodeElement(node: GraphNode, sourceColorMap: Record<string, string>): ElementDefinition {
  const label = node.name ?? node.label;
  const frequency = Math.max(node.frequency ?? node.weight ?? 1, 1);
  const labelLength = label.length;
  const size = Math.min(180, Math.max(78, 52 + labelLength * 5 + frequency * 6));
  const sourceTextbooks = node.source_textbooks ?? [];
  const sourceColors = sourceTextbooks.map((source) => sourceColorMap[source] ?? "#334155");
  const sourceSizes = buildPieSizes(node, sourceTextbooks);
  const fallbackColor =
    sourceColors[0] ?? CATEGORY_COLORS[node.group] ?? CATEGORY_COLORS[node.category ?? ""] ?? "#334155";

  const data: Record<string, unknown> = {
    id: node.id,
    label,
    name: node.name,
    definition: node.definition ?? "",
    chapter: node.chapter ?? "",
    page: node.page ?? 0,
    weight: frequency,
    size,
    textWidth: Math.max(72, size * 0.76),
    category: node.category ?? node.group,
    sourceCount: sourceTextbooks.length,
    fallbackColor,
    raw: node
  };

  for (let index = 0; index < 6; index += 1) {
    data[`pie${index + 1}Color`] = sourceColors[index] ?? "transparent";
    data[`pie${index + 1}Size`] = sourceSizes[index] ?? 0;
  }

  return {
    data
  };
}

function buildEdgeElement(edge: GraphEdge, index: number): ElementDefinition {
  return {
    data: {
      id: `${edge.source}-${edge.target}-${edge.relation_type ?? "related"}-${index}`,
      source: edge.source,
      target: edge.target,
      label: edge.relation_type ?? edge.label ?? "",
      lineWeight: Math.min(8, Math.max(3, Number(edge.weight ?? 1) + 2)),
      raw: edge
    }
  };
}

function buildStyles() {
  const styles = [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "text-wrap": "wrap" as const,
        "text-max-width": "data(textWidth)",
        "text-valign": "center" as const,
        "text-halign": "center" as const,
        "font-size": 15,
        color: "#ffffff",
        "text-outline-color": "#0f172a",
        "text-outline-width": 0.8,
        "background-color": "data(fallbackColor)",
        width: "data(size)",
        height: "data(size)",
        shape: "ellipse" as const,
        "border-width": 3,
        "border-color": "#0f172a",
        "overlay-opacity": 0,
        "pie-size": "100%",
        "pie-1-background-color": "data(pie1Color)",
        "pie-1-background-size": "data(pie1Size)",
        "pie-2-background-color": "data(pie2Color)",
        "pie-2-background-size": "data(pie2Size)",
        "pie-3-background-color": "data(pie3Color)",
        "pie-3-background-size": "data(pie3Size)",
        "pie-4-background-color": "data(pie4Color)",
        "pie-4-background-size": "data(pie4Size)",
        "pie-5-background-color": "data(pie5Color)",
        "pie-5-background-size": "data(pie5Size)",
        "pie-6-background-color": "data(pie6Color)",
        "pie-6-background-size": "data(pie6Size)"
      }
    },
    {
      selector: "edge",
      style: {
        width: "data(lineWeight)",
        "line-color": "#64748b",
        "target-arrow-color": "#64748b",
        "target-arrow-shape": "triangle" as const,
        "curve-style": "bezier" as const,
        opacity: 0.9
      }
    },
    {
      selector: ".dimmed",
      style: {
        opacity: 0.12
      }
    },
    {
      selector: "node.highlighted",
      style: {
        opacity: 1,
        "border-width": 5,
        "border-color": "#facc15"
      }
    },
    {
      selector: "edge.highlighted",
      style: {
        opacity: 1,
        "line-color": "#f59e0b",
        "target-arrow-color": "#f59e0b",
        width: 6
      }
    }
  ];

  return styles as unknown as CytoscapeStyle;
}

function collectSourceTextbooks(graph: GraphData | null) {
  if (!graph) {
    return [];
  }

  const fromGraph = graph.source_textbooks ?? [];
  const fromNodes = graph.nodes.flatMap((node) => node.source_textbooks ?? []);
  return Array.from(new Set([...fromGraph, ...fromNodes]));
}

function buildPieSizes(node: GraphNode, sourceTextbooks: string[]) {
  if (sourceTextbooks.length === 0) {
    return [100];
  }

  const counts = sourceTextbooks.map((source) => {
    const mentions = node.mentions?.filter((mention) => mention.textbook_title === source).length ?? 0;
    return mentions > 0 ? mentions : 1;
  });
  const total = counts.reduce((sum, value) => sum + value, 0);
  return counts.map((value) => Math.round((value / total) * 100));
}
