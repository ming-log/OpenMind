import type { SaveStatus } from "../domain/types";
import { DownloadIcon, FileTextIcon, MapIcon, NewDocumentIcon, RefreshIcon, SettingsIcon, ShareIcon, UploadIcon } from "./Icons";

interface ToolbarProps {
  mode: "map" | "markdown";
  status: SaveStatus;
  onNew: () => void;
  onImport: () => void;
  onExportMarkdown: () => void;
  onExportPng: () => void;
  onShare: () => void;
  onSync: () => void;
  onModeChange: (mode: "map" | "markdown") => void;
  onOpenSettings: () => void;
}

export function Toolbar(props: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="brand">
        <div className="brand-mark">O</div>
        <div>
          <strong>OpenMind</strong>
          <span>Markdown mind maps</span>
        </div>
      </div>
      <nav className="tool-actions" aria-label="Primary actions">
        <button onClick={props.onNew} title="新建" type="button"><NewDocumentIcon /></button>
        <button onClick={props.onImport} title="导入 Markdown" type="button"><UploadIcon /></button>
        <button className="tool-export" onClick={props.onExportMarkdown} title="导出 Markdown" type="button">
          <DownloadIcon />
          <span>MD</span>
        </button>
        <button className="tool-export" onClick={props.onExportPng} title="导出 PNG" type="button">
          <DownloadIcon />
          <span>PNG</span>
        </button>
        <button onClick={props.onShare} title="生成动态只读分享" type="button"><ShareIcon /></button>
        <button onClick={props.onSync} disabled={props.status === "syncing"} title="同步" type="button"><RefreshIcon /></button>
      </nav>
      <div className="mode-switch" aria-label="Editor mode" data-mode={props.mode}>
        <button className={props.mode === "map" ? "active" : ""} onClick={() => props.onModeChange("map")} type="button">
          <MapIcon />
          导图
        </button>
        <button className={props.mode === "markdown" ? "active" : ""} onClick={() => props.onModeChange("markdown")} type="button">
          <FileTextIcon />
          Markdown
        </button>
      </div>
      <button className="settings-button" onClick={props.onOpenSettings} title="设置" type="button">
        <SettingsIcon />
      </button>
    </header>
  );
}
