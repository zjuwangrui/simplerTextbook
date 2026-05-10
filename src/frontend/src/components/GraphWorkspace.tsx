import { GraphData, TextbookDetail, TextbookSummary } from "../types";
import { KnowledgeGraphCanvas } from "./KnowledgeGraphCanvas";

interface GraphWorkspaceProps {
  graph: GraphData | null;
  latestDetail: TextbookDetail | null;
  focusedSummary: TextbookSummary | null;
  onGenerateGraph: () => void;
}

export function GraphWorkspace({
  graph,
  latestDetail,
  focusedSummary,
  onGenerateGraph
}: GraphWorkspaceProps) {
  return (
    <section className="panel panel-center">
      <div className="section-heading">
        <div>
          <h2>知识图谱可视化</h2>
        </div>
        <div className="graph-header-actions">
          {latestDetail ? (
            <div className="graph-kpis">
              <span>{latestDetail.total_pages || latestDetail.stats.pages || 0} 页</span>
              <span>{latestDetail.stats.sections} 章节</span>
              <span>{latestDetail.stats.keywords} 关键词</span>
            </div>
          ) : null}
          {focusedSummary?.status === "ready" ? (
            <button
              className="primary-button"
              disabled={focusedSummary.graph_status === "building"}
              onClick={onGenerateGraph}
              type="button"
            >
              {focusedSummary.graph_status === "building"
                ? "图谱生成中"
                : focusedSummary.graph_status === "ready"
                  ? "重新生成图谱"
                  : "生成图谱"}
            </button>
          ) : null}
        </div>
      </div>
      <KnowledgeGraphCanvas graph={graph} />
    </section>
  );
}
