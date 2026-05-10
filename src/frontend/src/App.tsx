import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { api, buildFormData } from "./api";
import { GraphWorkspace } from "./components/GraphWorkspace";
import { HeroHeader } from "./components/HeroHeader";
import { RightPanel } from "./components/RightPanel";
import { TextbookSidebar } from "./components/TextbookSidebar";
import {
  AnalysisResult,
  DialogueTurn,
  GraphData,
  GraphStatusResponse,
  GraphStatus,
  IntegrationResult,
  QAResult,
  ReportItem,
  TabKey,
  TextbookDetail,
  TextbookSummary
} from "./types";
import { readError } from "./utils";
import "./styles.css";

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [isDragActive, setIsDragActive] = useState(false);

  const parsingCount = useMemo(
    () => textbooks.filter((item) => item.status === "parsing").length,
    [textbooks]
  );
  const graphBuildingCount = useMemo(
    () => textbooks.filter((item) => item.graph_status === "building").length,
    [textbooks]
  );
  const readyTextbooks = useMemo(
    () => textbooks.filter((item) => item.status === "ready"),
    [textbooks]
  );
  const focusedSummary = useMemo(
    () => textbooks.find((item) => item.id === focusedTextbookId) ?? null,
    [focusedTextbookId, textbooks]
  );

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!focusedTextbookId) {
      startTransition(() => {
        setLatestDetail(null);
        setGraph(null);
      });
      return;
    }
    void loadFocusedTextbook(focusedTextbookId);
  }, [focusedTextbookId, textbooks]);

  useEffect(() => {
    if (parsingCount === 0 && graphBuildingCount === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshTextbooks(false);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [parsingCount, graphBuildingCount]);

  async function loadInitialData() {
    setError("");
    try {
      const [textbookResponse, dialogueResponse, reportResponse] = await Promise.all([
        api.get<{ items: TextbookSummary[] }>("/api/textbooks"),
        api.get<{ items: DialogueTurn[] }>("/api/dialogue/history"),
        api.get<{ items: ReportItem[] }>("/api/reports")
      ]);

      startTransition(() => {
        setDialogueHistory(dialogueResponse.items);
        setReports(reportResponse.items);
      });
      applyTextbookState(textbookResponse.items);

      if (reportResponse.items.length > 0) {
        setLatestReportContent(reportResponse.items[0].content ?? "");
      }
    } catch (requestError) {
      setError(readError(requestError));
      setStatus("初始化失败，请检查后端配置。");
    }
  }

  async function refreshTextbooks(updateHeroStatus = true) {
    try {
      const response = await api.get<{ items: TextbookSummary[] }>("/api/textbooks");
      applyTextbookState(response.items, updateHeroStatus);
    } catch (requestError) {
      setError(readError(requestError));
    }
  }

  function applyTextbookState(items: TextbookSummary[], updateHeroStatus = true) {
    startTransition(() => {
      setTextbooks(items);
      setSelectedIds((current) => {
        const readyIds = items.filter((item) => item.status === "ready").map((item) => item.id);
        const preserved = current.filter((id) => readyIds.includes(id));
        return preserved.length > 0 ? preserved : readyIds;
      });
      setFocusedTextbookId((current) => {
        if (current && items.some((item) => item.id === current)) {
          return current;
        }
        return items[0]?.id ?? null;
      });
    });

    if (!updateHeroStatus && items.some((item) => isActiveJob(item.graph_status, item.status))) {
      return;
    }

    if (items.length === 0) {
      setStatus("当前还没有教材，先从左侧上传。");
      return;
    }

    const pendingParse = items.filter((item) => item.status === "parsing").length;
    const pendingGraph = items.filter((item) => item.graph_status === "building").length;
    if (pendingParse > 0 || pendingGraph > 0) {
      setStatus(
        `已接收 ${items.length} 本教材，解析中 ${pendingParse} 本，图谱生成中 ${pendingGraph} 本。`
      );
      return;
    }

    setStatus(`已加载 ${items.length} 本教材。`);
  }

  async function loadFocusedTextbook(textbookId: string) {
    try {
      const [detailResponse, graphResponse] = await Promise.all([
        api.get<TextbookDetail>(`/api/textbooks/${textbookId}`),
        api.get<GraphData>(`/api/graphs/textbooks/${textbookId}`)
      ]);

      startTransition(() => {
        setLatestDetail(detailResponse);
        setGraph(graphResponse);
      });
    } catch (requestError) {
      setError(readError(requestError));
    }
  }

  async function loadCombinedGraph() {
    setError("");
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

  async function triggerGraphGeneration() {
    if (!focusedTextbookId) {
      setError("请先选择教材。");
      return;
    }

    setError("");
    setStatus("正在提交知识图谱生成任务...");
    try {
      await api.post<GraphStatusResponse>(`/api/graphs/textbooks/${focusedTextbookId}/generate`, {});
      await refreshTextbooks(false);
      setStatus("知识图谱生成任务已提交。");
    } catch (requestError) {
      setError(readError(requestError));
      setStatus("知识图谱生成失败。");
    }
  }

  async function handleUploadInput(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    await uploadFiles(files);
    event.target.value = "";
  }

  async function uploadFiles(files: File[]) {
    setError("");
    setStatus(`正在上传 ${files.length} 个文件...`);

    try {
      const response = await api.upload<{ items: TextbookSummary[] }>(
        "/api/textbooks/upload",
        buildFormData(files)
      );
      await refreshTextbooks(false);
      setStatus(`已接收 ${response.items.length} 个文件，正在后台逐页解析。`);
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
    const readyIds = selectedIds.filter((id) => readyTextbooks.some((item) => item.id === id));
    const fallbackIds = readyTextbooks.map((item) => item.id);
    const targetIds = readyIds.length > 0 ? readyIds : fallbackIds;
    if (targetIds.length === 0) {
      throw new Error("当前没有已完成解析的教材。");
    }
    return targetIds;
  }

  function toggleSelection(textbookId: string) {
    const target = textbooks.find((item) => item.id === textbookId);
    if (!target || target.status !== "ready") {
      return;
    }

    setSelectedIds((current) =>
      current.includes(textbookId)
        ? current.filter((item) => item !== textbookId)
        : [...current, textbookId]
    );
  }

  function handleDropZoneClick() {
    fileInputRef.current?.click();
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0) {
      return;
    }
    await uploadFiles(files);
  }

  return (
    <div className="page-shell">
      <HeroHeader
        error={error}
        graphBuildingCount={graphBuildingCount}
        parsingCount={parsingCount}
        status={status}
      />

      <main className="workspace-grid">
        <TextbookSidebar
          fileInputRef={fileInputRef}
          focusedTextbookId={focusedTextbookId}
          isDragActive={isDragActive}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={(event) => void handleDrop(event)}
          onDropZoneClick={handleDropZoneClick}
          onFileInputChange={(event) => void handleUploadInput(event)}
          onFocusTextbook={setFocusedTextbookId}
          onOpenCombinedGraph={() => void loadCombinedGraph()}
          onToggleSelection={toggleSelection}
          selectedIds={selectedIds}
          textbooks={textbooks}
        />

        <GraphWorkspace
          focusedSummary={focusedSummary}
          graph={graph}
          latestDetail={latestDetail}
          onGenerateGraph={() => void triggerGraphGeneration()}
        />

        <RightPanel
          activeTab={activeTab}
          analysis={analysis}
          dialogueHistory={dialogueHistory}
          integration={integration}
          latestReportContent={latestReportContent}
          onAskQuestion={(event) => void askQuestion(event)}
          onGenerateReport={() => void generateReport()}
          onQuestionChange={setQuestion}
          onRatioChange={setRatio}
          onRunAnalysis={() => void runAnalysis()}
          onRunIntegration={(event) => void runIntegration(event)}
          onSendTeacherMessage={(event) => void sendTeacherMessage(event)}
          onTabChange={setActiveTab}
          onTeacherMessageChange={setTeacherMessage}
          qaResult={qaResult}
          question={question}
          ratio={ratio}
          reports={reports}
          teacherMessage={teacherMessage}
        />
      </main>
    </div>
  );
}

function isActiveJob(graphStatus: GraphStatus, textbookStatus: TextbookSummary["status"]) {
  return textbookStatus === "parsing" || graphStatus === "building";
}
