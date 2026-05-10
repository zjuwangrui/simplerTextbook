import { TextbookSummary } from "../types";
import { formatFileSize, graphStatusLabel, statusLabel } from "../utils";

interface TextbookListItemProps {
  item: TextbookSummary;
  isFocused: boolean;
  isSelected: boolean;
  onFocus: (textbookId: string) => void;
  onToggle: (textbookId: string) => void;
}

export function TextbookListItem({
  item,
  isFocused,
  isSelected,
  onFocus,
  onToggle
}: TextbookListItemProps) {
  return (
    <article className={`book-item ${isFocused ? "book-item-active" : ""}`}>
      <div className="book-head">
        <input
          checked={isSelected}
          disabled={item.status !== "ready"}
          onChange={() => onToggle(item.id)}
          type="checkbox"
        />
        <button className="book-title" onClick={() => onFocus(item.id)} type="button">
          {item.title}
        </button>
      </div>
      <p>{item.filename}</p>
      <div className="meta-row">
        <span>{item.format.toUpperCase()}</span>
        <span>{formatFileSize(item.file_size_bytes)}</span>
        <span className={`status-chip status-${item.status}`}>{statusLabel(item.status)}</span>
      </div>
      <div className="meta-row">
        <span>{item.total_pages || item.stats.pages || 0} 页</span>
        <span>{item.total_chars || item.stats.characters || 0} 字</span>
        <span>{item.parse_progress.percent ?? 0}%</span>
      </div>
      <p className="progress-text">{item.parse_progress.message || "等待处理"}</p>
      <p className="progress-text">{graphStatusLabel(item.graph_status)}</p>
      {item.graph_status === "building" ? (
        <p className="progress-text">{item.graph_progress.message}</p>
      ) : null}
      {item.error_message ? <p className="error-text">{item.error_message}</p> : null}
      {item.graph_error_message ? <p className="error-text">{item.graph_error_message}</p> : null}
      <div className="keyword-row">
        {item.keyword_preview.map((keyword) => (
          <span className="keyword-chip" key={keyword}>
            {keyword}
          </span>
        ))}
      </div>
    </article>
  );
}
