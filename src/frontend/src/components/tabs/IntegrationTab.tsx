import { FormEvent } from "react";

import { AnalysisResult, IntegrationResult } from "../../types";

interface IntegrationTabProps {
  analysis: AnalysisResult | null;
  integration: IntegrationResult | null;
  ratio: string;
  onRatioChange: (value: string) => void;
  onRunAnalysis: () => void;
  onRunIntegration: (event: FormEvent<HTMLFormElement>) => void;
}

export function IntegrationTab({
  analysis,
  integration,
  ratio,
  onRatioChange,
  onRunAnalysis,
  onRunIntegration
}: IntegrationTabProps) {
  return (
    <div className="tab-panel">
      <div className="panel-actions">
        <button className="primary-button" onClick={onRunAnalysis} type="button">
          跨教材分析
        </button>
      </div>
      {analysis ? (
        <section className="result-card">
          <h3>分析结果</h3>
          <p>共享主题数: {analysis.overview.shared_keyword_count}</p>
          <p>{analysis.shared_keywords.slice(0, 6).map((item) => item.term).join("、") || "暂无"}</p>
        </section>
      ) : null}

      <form className="stack-form" onSubmit={onRunIntegration}>
        <label>
          目标压缩比例
          <input
            max="0.5"
            min="0.1"
            onChange={(event) => onRatioChange(event.target.value)}
            step="0.05"
            type="number"
            value={ratio}
          />
        </label>
        <button className="primary-button" type="submit">
          生成整合摘要
        </button>
      </form>

      {integration ? (
        <section className="result-card">
          <h3>整合摘要</h3>
          <p>
            原文字数 {integration.original_characters}，摘要字数 {integration.summary_characters}
          </p>
          <pre>{integration.summary_text}</pre>
        </section>
      ) : null}
    </div>
  );
}
