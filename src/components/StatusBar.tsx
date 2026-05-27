import type { DocumentState } from "../domain/types";
import { StatusDotIcon } from "./Icons";

interface StatusBarProps {
  document: DocumentState;
  message: string;
}

const labels = {
  saved: "已保存",
  dirty: "未保存",
  syncing: "同步中",
  syncFailed: "同步失败",
};

export function StatusBar({ document, message }: StatusBarProps) {
  const syncLabel = document.lastSyncedAt ? `最近同步 ${new Date(document.lastSyncedAt).toLocaleString()}` : "尚未同步";
  const syncClass = document.syncError ? "syncFailed" : document.lastSyncedAt ? "saved" : "dirty";

  return (
    <footer className="status-bar">
      <div className="status-left">
        <span className="status-file">{document.fileName}</span>
        {message ? <span className="status-message">{message}</span> : null}
      </div>
      <div className="status-right">
        <span className={`status-pill ${document.saveStatus}`}>
          <StatusDotIcon />
          {labels[document.saveStatus]}
        </span>
        <span className={`sync-indicator ${syncClass}`}>
          <StatusDotIcon />
          {document.syncError ?? syncLabel}
        </span>
        {document.warnings.map((warning) => (
          <span className="warning" key={warning}>{warning}</span>
        ))}
      </div>
    </footer>
  );
}
