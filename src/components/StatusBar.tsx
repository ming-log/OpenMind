import type { DocumentState } from "../domain/types";

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
  return (
    <footer className="status-bar">
      <span>{document.fileName}</span>
      <span className={`status-pill ${document.saveStatus}`}>{labels[document.saveStatus]}</span>
      {document.lastSyncedAt ? <span>最近同步 {new Date(document.lastSyncedAt).toLocaleString()}</span> : <span>尚未同步</span>}
      {document.warnings.map((warning) => (
        <span className="warning" key={warning}>{warning}</span>
      ))}
      {document.syncError ? <span className="warning">{document.syncError}</span> : null}
      {message ? <span>{message}</span> : null}
    </footer>
  );
}
