import { ChangeEvent, DragEvent, RefObject } from "react";

import { TextbookSummary } from "../types";
import { TextbookListItem } from "./TextbookListItem";

interface TextbookSidebarProps {
  fileInputRef: RefObject<HTMLInputElement>;
  isDragActive: boolean;
  textbooks: TextbookSummary[];
  selectedIds: string[];
  focusedTextbookId: string | null;
  onOpenCombinedGraph: () => void;
  onFocusTextbook: (textbookId: string) => void;
  onToggleSelection: (textbookId: string) => void;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDropZoneClick: () => void;
}

export function TextbookSidebar({
  fileInputRef,
  isDragActive,
  textbooks,
  selectedIds,
  focusedTextbookId,
  onOpenCombinedGraph,
  onFocusTextbook,
  onToggleSelection,
  onFileInputChange,
  onDrop,
  onDragOver,
  onDragLeave,
  onDropZoneClick
}: TextbookSidebarProps) {
  return (
    <aside className="panel panel-left">
      <section className="upload-card">
        <div className="section-heading">
          <h2>教材管理</h2>
          <p>支持 PDF、Markdown、TXT、Word.docx，支持拖拽和批量上传</p>
        </div>
        <div
          className={`upload-dropzone ${isDragActive ? "upload-dropzone-active" : ""}`}
          onClick={onDropZoneClick}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
        >
          <input
            accept=".pdf,.md,.txt,.docx"
            multiple
            onChange={onFileInputChange}
            ref={fileInputRef}
            type="file"
          />
          <strong>拖拽文件到这里</strong>
          <span>或点击选择多个教材文件</span>
        </div>
      </section>

      <section className="list-card">
        <div className="section-heading">
          <h3>教材列表</h3>
          <button className="ghost-button" onClick={onOpenCombinedGraph} type="button">
            组合图谱
          </button>
        </div>
        <div className="book-list">
          {textbooks.map((item) => (
            <TextbookListItem
              item={item}
              isFocused={focusedTextbookId === item.id}
              isSelected={selectedIds.includes(item.id)}
              key={item.id}
              onFocus={onFocusTextbook}
              onToggle={onToggleSelection}
            />
          ))}
          {textbooks.length === 0 ? (
            <p className="empty-state">上传后会在这里展示文件名、格式、大小和解析状态。</p>
          ) : null}
        </div>
      </section>
    </aside>
  );
}
