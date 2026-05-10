import { FormEvent } from "react";

import { DialogueTurn } from "../../types";

interface DialogueTabProps {
  teacherMessage: string;
  dialogueHistory: DialogueTurn[];
  onTeacherMessageChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function DialogueTab({
  teacherMessage,
  dialogueHistory,
  onTeacherMessageChange,
  onSubmit
}: DialogueTabProps) {
  return (
    <div className="tab-panel">
      <form className="stack-form" onSubmit={onSubmit}>
        <label>
          教师反馈
          <textarea
            onChange={(event) => onTeacherMessageChange(event.target.value)}
            placeholder="例如：第三章内容压缩过多，请保留更多案例。"
            value={teacherMessage}
          />
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
        {dialogueHistory.length === 0 ? (
          <p className="empty-state">这里会累积教师与系统的迭代记录。</p>
        ) : null}
      </div>
    </div>
  );
}
