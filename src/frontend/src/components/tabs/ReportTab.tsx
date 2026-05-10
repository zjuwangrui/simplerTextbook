import { ReportItem } from "../../types";

interface ReportTabProps {
  reports: ReportItem[];
  latestReportContent: string;
  onGenerateReport: () => void;
}

export function ReportTab({
  reports,
  latestReportContent,
  onGenerateReport
}: ReportTabProps) {
  return (
    <div className="tab-panel">
      <div className="panel-actions">
        <button className="primary-button" onClick={onGenerateReport} type="button">
          生成报告
        </button>
      </div>
      <section className="result-card">
        <h3>报告列表</h3>
        {reports.map((item) => (
          <div className="report-row" key={`${item.filename}-${item.generated_at}`}>
            <span>{item.filename}</span>
            <span>{item.generated_at}</span>
          </div>
        ))}
        {reports.length === 0 ? <p className="empty-state">还没有生成任何分析报告。</p> : null}
      </section>
      <section className="result-card">
        <h3>最新报告内容</h3>
        <pre>{latestReportContent || "生成报告后，这里显示最新结果。"}</pre>
      </section>
    </div>
  );
}
