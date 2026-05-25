import type { SaveStatus } from "../domain/types";

interface ToolbarProps {
  mode: "map" | "markdown";
  status: SaveStatus;
  onNew: () => void;
  onImport: () => void;
  onExportMarkdown: () => void;
  onExportPng: () => void;
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
        <button onClick={props.onNew} title="新建">＋</button>
        <button onClick={props.onImport} title="导入 Markdown">⇪</button>
        <button onClick={props.onExportMarkdown} title="导出 Markdown">⇩ MD</button>
        <button onClick={props.onExportPng} title="导出 PNG">⇩ PNG</button>
        <button onClick={props.onSync} disabled={props.status === "syncing"} title="同步">↻</button>
      </nav>
      <div className="mode-switch" aria-label="Editor mode">
        <button className={props.mode === "map" ? "active" : ""} onClick={() => props.onModeChange("map")}>
          导图
        </button>
        <button className={props.mode === "markdown" ? "active" : ""} onClick={() => props.onModeChange("markdown")}>
          Markdown
        </button>
      </div>
      <button className="settings-button" onClick={props.onOpenSettings} title="设置">
        ⚙
      </button>
    </header>
  );
}
