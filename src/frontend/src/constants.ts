import { TabKey } from "./types";

export const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "integration", label: "整合操作" },
  { key: "qa", label: "RAG问答" },
  { key: "dialogue", label: "教师对话" },
  { key: "report", label: "分析报告" }
];
