import { ChangeEvent, FormEvent, startTransition, useEffect, useState } from "react";

import { api, buildFormData } from "./api";
import { KnowledgeGraphCanvas } from "./components/KnowledgeGraphCanvas";
import {
  AnalysisResult,
  DialogueTurn,
  GraphData,
  IntegrationResult,
  ReportItem,
  TabKey,
  TextbookDetail,
  TextbookSummary,
  QAResult
} from "./types";
import "./styles.css";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "integration", label: "整合操作" },
  { key: "qa", label: "RAG问答" },
  { key: "dialogue", label: "教师对话" },
  { key: "report", label: "分析报告" }
];

export default function App() {
  const [textbooks, setTextbooks] = useState<TextbookSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusedTextbookId, setFocusedTextbookId] = useState<string | null>(null);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [integration, setIntegration] = useState<IntegrationResult | null>(null);
  const [qaResult, setQaResult] = useState<QAResult | null>(null);
  const [dialogueHistory, setDialogueHistory] = useState<DialogueTurn[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("integration");
  const [ratio, setRatio] = useState("0.3");
  const [question, setQuestion] = useState("");
  const [teacherMessage, setTeacherMessage] = useState("");
  const [status, setStatus] = useState("正在加载系统状态...");
  const [error, setError] = useState("");
  const [latestDetail, setLatestDetail] = useState<TextbookDetail | null>(null);
  const [latestReportContent, setLatestReportContent] = useState("");

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => {
    if (!focusedTextbookId) {
      return;
    }
    void loadTextbookGraph(focusedTextbookId);
  }, [focusedTextbookId]);

  async function hydrate() {
    setError("");
    try {
      const [textbookResponse, dialogueResponse, reportResponse] = await Promise.all([
        api.get<{ items: TextbookSummary[] }>("/api/textbooks"),
        api.get<{ items: DialogueTurn[] }>("/api/dialogue/history"),
        api.get<{ items: ReportItem[] }>("/api/reports")
      ]);

      startTransition(() => {
        setTextbooks(textbookResponse.items);
        setDialogueHistory(dialogueResponse.items);
        setReports(reportResponse.items);
      });

      if (textbookResponse.items.length > 0) {
        const ids = textbookResponse.items.map((item) => item.id);
        setSelectedIds(ids);
        setFocusedTextbookId(textbookResponse.items[0].id);
        const detail = await api.get<TextbookDetail>(`/api/textbooks/${textbookResponse.items[0].id}`);
        setLatestDetail(detail);
        setStatus(`已加载 ${textbookResponse.items.length} 本教材。`);
      } else {
        setStatus("当前还没有教材，先从左侧上传。");
      }

      if (reportResponse.items.length > 0) {
        setLatestReportContent(reportResponse.items[0].content ?? "");
      }
    } catch (requestError) {
      setError(readError(requestError));
      setStatus("初始化失败，请检查后端配置。");
    }
  }

  async function loadTextbookGraph(textbookId: string) {
    try {
      const [graphResponse, detailResponse] = await Promise.all([
        api.get<GraphData>(`/api/graphs/textbooks/${textbookId}`),
        api.get<TextbookDetail>(`/api/textbooks/${textbookId}`)
      ]);
      startTransition(() => {
        setGraph(graphResponse);
        setLatestDetail(detailResponse);
      });
    } catch (requestError) {
      setError(readError(requestError));
    }
  }

  async function loadCombinedGraph() {
    try {
      const result = await api.post<GraphData>("/api/graphs/combined", {
        textbook_ids: resolveScopeIds()
      });
      startTransition(() => setGraph(result));
      setStatus("已切换到组合图谱视图。");
    } catch (requestError) {
      setError(readError(requestError));
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setError("");
    setStatus("正在上传并解析教材...");
    try {
      await api.upload<{ items: TextbookSummary[] }>("/api/textbooks/upload", buildFormData(files));
      event.target.value = "";
      await hydrate();
      setStatus("教材上传完成，图谱与索引已更新。");
    } catch (requestError) {
      setError(readError(requestError));
      setStatus("教材上传失败。");
    }
  }

  async function runAnalysis() {
    setError("");
    setStatus("正在执行跨教材对比分析...");
    try {
      const result = await api.post<AnalysisResult>("/api/analysis/compare", {
        textbook_ids: resolveScopeIds()
      });
      startTransition(() => {
        setAnalysis(result);
        setGraph(result.combined_graph);
      });
      setStatus("跨教材分析完成。");
    } catch (requestError) {
      setError(readError(requestError));
      setStatus("跨教材分析失败。");
    }
  }

  async function runIntegration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("正在生成整合摘要...");
    try {
      const result = await api.post<IntegrationResult>("/api/integration/generate", {
        textbook_ids: resolveScopeIds(),
        ratio: Number(ratio)
      });
      startTransition(() => setIntegration(result));
      setStatus("整合摘要已生成。");
    } catch (requestError) {
      setError(readError(requestError));
      setStatus("整合摘要生成失败。");
    }
  }

  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("正在执行检索问答...");
    try {
      const result = await api.post<QAResult>("/api/qa/ask", {
        textbook_ids: resolveScopeIds(),
        question
      });
      startTransition(() => setQaResult(result));
      setStatus(`问答完成，生成模式: ${result.mode}`);
    } catch (requestError) {
      setError(readError(requestError));
      setStatus("问答失败。");
    }
  }

  async function sendTeacherMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("正在整理教师反馈...");
    try {
      const result = await api.post<DialogueTurn>("/api/dialogue/message", {
        textbook_ids: resolveScopeIds(),
        message: teacherMessage
      });
      startTransition(() => {
        setDialogueHistory((current) => [result, ...current]);
        setTeacherMessage("");
      });
      setStatus(`教师对话已记录，生成模式: ${result.mode}`);
    } catch (requestError) {
      setError(readError(requestError));
      setStatus("教师对话失败。");
    }
  }

  async function generateReport() {
    setError("");
    setStatus("正在生成分析报告...");
    try {
      const result = await api.post<ReportItem>("/api/reports/generate", {
        textbook_ids: resolveScopeIds()
      });
      startTransition(() => {
        setReports((current) => [result, ...current]);
        setLatestReportContent(result.content ?? "");
      });
      setStatus("报告已生成并保存到后端目录。");
    } catch (requestError) {
      setError(readError(requestError));
      setStatus("报告生成失败。");
    }
  }

  function resolveScopeIds() {
    return selectedIds.length > 0 ? selectedIds : textbooks.map((item) => item.id);
  }

  function toggleSelection(textbookId: string) {
    setSelectedIds((current) =>
      current.includes(textbookId) ? current.filter((item) => item !== textbookId) : [...current, textbookId]
    );
  }

  return (
    <div className="page-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">SimplerTextbook</p>
          <h1>学科知识整合智能体初版</h1>
          <p className="hero-copy">
            左侧管理教材，中间观察图谱，右侧直接完成整合、问答、教师反馈和报告输出。
          </p>
        </div>
        <div className="hero-status">
          <span className="status-pill">{status}</span>
          {error ? <span className="status-pill error-pill">{error}</span> : null}
        </div>
      </header>

      <main className="workspace-grid">
        <aside className="panel panel-left">
          <section className="upload-card">
            <div className="section-heading">
              <h2>教材管理</h2>
              <p>支持 `pdf`、`docx`、`txt`、`md`</p>
            </div>
            <label className="upload-field">
              <span>上传多本教材</span>
              <input multiple type="file" onChange={handleUpload} />
            </label>
          </section>

          <section className="list-card">
            <div className="section-heading">
              <h3>教材列表</h3>
              <button className="ghost-button" onClick={() => void loadCombinedGraph()} type="button">
                组合图谱
              </button>
            </div>
            <div className="book-list">
              {textbooks.map((item) => (
                <article
                  className={`book-item ${focusedTextbookId === item.id ? "book-item-active" : ""}`}
                  key={item.id}
                >
                  <div className="book-head">
                    <input
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelection(item.id)}
                      type="checkbox"
                    />
                    <button className="book-title" onClick={() => setFocusedTextbookId(item.id)} type="button">
                      {item.title}
                    </button>
                  </div>
                  <p>{item.filename}</p>
                  <div className="meta-row">
                    <span>{item.format.toUpperCase()}</span>
                    <span>{item.stats.characters} 字</span>
                  </div>
                  <div className="keyword-row">
                    {item.keyword_preview.map((keyword) => (
                      <span className="keyword-chip" key={keyword}>
                        {keyword}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
              {textbooks.length === 0 ? <p className="empty-state">上传后会在这里展示教材状态。</p> : null}
            </div>
          </section>
        </aside>

        <section className="panel panel-center">
          <div className="section-heading">
            <div>
              <h2>知识图谱可视化</h2>
              <p>优先展示当前教材图谱，也可切换为多教材组合图谱。</p>
            </div>
            {latestDetail ? (
              <div className="graph-kpis">
                <span>{latestDetail.stats.sections} 章节</span>
                <span>{latestDetail.stats.chunks} 检索块</span>
                <span>{latestDetail.stats.keywords} 关键词</span>
              </div>
            ) : null}
          </div>
          <KnowledgeGraphCanvas graph={graph} />

          <div className="insight-strip">
            <article className="insight-card">
              <h3>教材摘要预览</h3>
              <p>{latestDetail?.summary_preview ?? "上传教材后，这里会展示自动提取的内容预览。"}</p>
            </article>
            <article className="insight-card">
              <h3>当前分析焦点</h3>
              <p>
                {analysis
                  ? `已识别 ${analysis.shared_keywords.length} 个共享主题，可在右侧继续做摘要整合和问答。`
                  : "先执行跨教材分析，再查看重叠、互补与缺失主题。"}
              </p>
            </article>
          </div>
        </section>

        <aside className="panel panel-right">
          <div className="tab-row">
            {tabs.map((tab) => (
              <button
                className={`tab-button ${activeTab === tab.key ? "tab-button-active" : ""}`}
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "integration" ? (
            <div className="tab-panel">
              <div className="panel-actions">
                <button className="primary-button" onClick={() => void runAnalysis()} type="button">
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

              <form className="stack-form" onSubmit={runIntegration}>
                <label>
                  目标压缩比例
                  <input max="0.5" min="0.1" onChange={(event) => setRatio(event.target.value)} step="0.05" type="number" value={ratio} />
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
          ) : null}

          {activeTab === "qa" ? (
            <div className="tab-panel">
              <form className="stack-form" onSubmit={askQuestion}>
                <label>
                  输入问题
                  <textarea onChange={(event) => setQuestion(event.target.value)} placeholder="例如：这些教材在核心概念解释上有哪些共同点？" value={question} />
                </label>
                <button className="primary-button" type="submit">
                  开始问答
                </button>
              </form>

              {qaResult ? (
                <section className="result-card">
                  <h3>回答</h3>
                  <pre>{qaResult.answer}</pre>
                  <h4>引用片段</h4>
                  <div className="citation-list">
                    {qaResult.citations.map((citation) => (
                      <article className="citation-item" key={`${citation.chunk_id}-${citation.textbook_id}`}>
                        <strong>
                          {citation.textbook_title} / {citation.section_title}
                        </strong>
                        <p>{citation.content}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {activeTab === "dialogue" ? (
            <div className="tab-panel">
              <form className="stack-form" onSubmit={sendTeacherMessage}>
                <label>
                  教师反馈
                  <textarea onChange={(event) => setTeacherMessage(event.target.value)} placeholder="例如：第三章内容压缩过多，请保留更多案例。" value={teacherMessage} />
                </label>
                <button className="primary-button" type="submit">
                  发送反馈
                </button>
              </form>

              <div className="dialogue-stream">
                {dialogueHistory.map((item) => (
                  <article className="dialogue-item" key={item.id}>
                    <p className="dialogue-role">教师</p>
                    <p>{item.teacher_message}</p>
                    <p className="dialogue-role">系统</p>
                    <p>{item.assistant_message}</p>
                  </article>
                ))}
                {dialogueHistory.length === 0 ? <p className="empty-state">这里会累积教师与系统的迭代记录。</p> : null}
              </div>
            </div>
          ) : null}

          {activeTab === "report" ? (
            <div className="tab-panel">
              <div className="panel-actions">
                <button className="primary-button" onClick={() => void generateReport()} type="button">
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
                <pre>{latestReportContent || "生成报告后，这里显示最新结果。"} </pre>
              </section>
            </div>
          ) : null}
        </aside>
      </main>
    </div>
  );
}

function readError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "未知错误";
}
