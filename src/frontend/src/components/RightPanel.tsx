import { FormEvent } from "react";

import { TABS } from "../constants";
import {
  AnalysisResult,
  DialogueTurn,
  IntegrationResult,
  QAResult,
  ReportItem,
  TabKey
} from "../types";
import { DialogueTab } from "./tabs/DialogueTab";
import { IntegrationTab } from "./tabs/IntegrationTab";
import { QATab } from "./tabs/QATab";
import { ReportTab } from "./tabs/ReportTab";

interface RightPanelProps {
  activeTab: TabKey;
  analysis: AnalysisResult | null;
  integration: IntegrationResult | null;
  qaResult: QAResult | null;
  dialogueHistory: DialogueTurn[];
  reports: ReportItem[];
  ratio: string;
  question: string;
  teacherMessage: string;
  latestReportContent: string;
  onTabChange: (tab: TabKey) => void;
  onRatioChange: (value: string) => void;
  onQuestionChange: (value: string) => void;
  onTeacherMessageChange: (value: string) => void;
  onRunAnalysis: () => void;
  onRunIntegration: (event: FormEvent<HTMLFormElement>) => void;
  onAskQuestion: (event: FormEvent<HTMLFormElement>) => void;
  onSendTeacherMessage: (event: FormEvent<HTMLFormElement>) => void;
  onGenerateReport: () => void;
}

export function RightPanel(props: RightPanelProps) {
  const {
    activeTab,
    analysis,
    integration,
    qaResult,
    dialogueHistory,
    reports,
    ratio,
    question,
    teacherMessage,
    latestReportContent,
    onTabChange,
    onRatioChange,
    onQuestionChange,
    onTeacherMessageChange,
    onRunAnalysis,
    onRunIntegration,
    onAskQuestion,
    onSendTeacherMessage,
    onGenerateReport
  } = props;

  return (
    <aside className="panel panel-right">
      <div className="tab-row">
        {TABS.map((tab) => (
          <button
            className={`tab-button ${activeTab === tab.key ? "tab-button-active" : ""}`}
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "integration" ? (
        <IntegrationTab
          analysis={analysis}
          integration={integration}
          onRatioChange={onRatioChange}
          onRunAnalysis={onRunAnalysis}
          onRunIntegration={onRunIntegration}
          ratio={ratio}
        />
      ) : null}

      {activeTab === "qa" ? (
        <QATab
          onQuestionChange={onQuestionChange}
          onSubmit={onAskQuestion}
          qaResult={qaResult}
          question={question}
        />
      ) : null}

      {activeTab === "dialogue" ? (
        <DialogueTab
          dialogueHistory={dialogueHistory}
          onSubmit={onSendTeacherMessage}
          onTeacherMessageChange={onTeacherMessageChange}
          teacherMessage={teacherMessage}
        />
      ) : null}

      {activeTab === "report" ? (
        <ReportTab
          latestReportContent={latestReportContent}
          onGenerateReport={onGenerateReport}
          reports={reports}
        />
      ) : null}
    </aside>
  );
}
