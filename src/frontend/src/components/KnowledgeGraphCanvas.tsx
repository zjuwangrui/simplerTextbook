import { GraphData, GraphNode } from "../types";

interface KnowledgeGraphCanvasProps {
  graph: GraphData | null;
}

const GROUP_COLORS: Record<string, string> = {
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
  "应用场景": "#65a30d"
};

export function KnowledgeGraphCanvas({ graph }: KnowledgeGraphCanvasProps) {
  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="graph-empty">
        <p>上传教材或切换图谱视图后，这里会展示知识图谱。</p>
      </div>
    );
  }

  const width = 860;
  const height = 560;
  const centerX = width / 2;
  const centerY = height / 2;
  const placedNodes = graph.nodes.map((node, index) => placeNode(node, index, graph.nodes.length, centerX, centerY));
  const legendGroups = Array.from(new Set(placedNodes.map((node) => node.group)));

  return (
    <div className="graph-shell">
      <svg className="graph-svg" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="graphBackground" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#fefce8" />
            <stop offset="100%" stopColor="#ecfeff" />
          </linearGradient>
        </defs>
        <rect fill="url(#graphBackground)" height={height} rx="28" width={width} x="0" y="0" />
        {graph.edges.map((edge, index) => {
          const source = placedNodes.find((node) => node.id === edge.source);
          const target = placedNodes.find((node) => node.id === edge.target);
          if (!source || !target) {
            return null;
          }
          return (
            <line
              key={`${edge.source}-${edge.target}-${index}`}
              opacity="0.34"
              stroke="#94a3b8"
              strokeWidth={Math.max(edge.weight, 1)}
              x1={source.x}
              x2={target.x}
              y1={source.y}
              y2={target.y}
            />
          );
        })}
        {placedNodes.map((node) => (
          <g key={node.id}>
            <circle
              cx={node.x}
              cy={node.y}
              fill={GROUP_COLORS[node.group] ?? "#334155"}
              opacity="0.92"
              r={18 + Math.min(node.weight, 8)}
            />
            <text className="graph-label" textAnchor="middle" x={node.x} y={node.y + 4}>
              {truncate(node.label, 10)}
            </text>
          </g>
        ))}
      </svg>
      <div className="graph-legend">
        {legendGroups.map((group) => (
          <span className="legend-item" key={group}>
            <i style={{ backgroundColor: GROUP_COLORS[group] ?? "#334155" }} />
            {group}
          </span>
        ))}
      </div>
    </div>
  );
}

function placeNode(node: GraphNode, index: number, total: number, centerX: number, centerY: number) {
  const angle = (Math.PI * 2 * index) / Math.max(total, 1);
  const radius = node.group === "section" || node.group === "textbook" ? 128 : 220;
  const wobble = node.weight * 4;
  return {
    ...node,
    x: centerX + Math.cos(angle) * (radius + wobble),
    y: centerY + Math.sin(angle) * (radius - wobble / 2)
  };
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}
