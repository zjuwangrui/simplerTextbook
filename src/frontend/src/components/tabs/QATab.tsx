import { FormEvent } from "react";

import { QAResult } from "../../types";

interface QATabProps {
  question: string;
  qaResult: QAResult | null;
  onQuestionChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function QATab({ question, qaResult, onQuestionChange, onSubmit }: QATabProps) {
  return (
    <div className="tab-panel">
      <form className="stack-form" onSubmit={onSubmit}>
        <label>
          输入问题
          <textarea
            onChange={(event) => onQuestionChange(event.target.value)}
            placeholder="例如：这些教材在核心概念解释上有哪些共同点？"
            value={question}
          />
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
  );
}
