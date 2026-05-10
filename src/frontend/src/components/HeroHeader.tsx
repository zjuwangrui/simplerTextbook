interface HeroHeaderProps {
  status: string;
  parsingCount: number;
  graphBuildingCount: number;
  error: string;
}

export function HeroHeader({
  status,
  parsingCount,
  graphBuildingCount,
  error
}: HeroHeaderProps) {
  return (
    <header className="hero">
      <div>
        <p className="eyebrow">SimplerTextbook</p>
        <h1>学科知识整合智能体</h1>
      </div>
      <div className="hero-status">
        <span className="status-pill">{status}</span>
        {parsingCount > 0 ? (
          <span className="status-pill progress-pill">解析队列中: {parsingCount} 本</span>
        ) : null}
        {graphBuildingCount > 0 ? (
          <span className="status-pill progress-pill">图谱生成中: {graphBuildingCount} 本</span>
        ) : null}
        {error ? <span className="status-pill error-pill">{error}</span> : null}
      </div>
    </header>
  );
}
