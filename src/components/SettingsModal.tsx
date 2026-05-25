import type { BackupEntry, WebDavConfig } from "../domain/types";

interface SettingsModalProps {
  config: WebDavConfig;
  backups: BackupEntry[];
  testMessage: string;
  onClose: () => void;
  onConfigChange: (config: WebDavConfig) => void;
  onTestConnection: () => void;
  onDownloadBackup: (backup: BackupEntry) => void;
}

export function SettingsModal(props: SettingsModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="settings-modal">
        <header>
          <h2>设置</h2>
          <button onClick={props.onClose}>×</button>
        </header>
        <div className="settings-grid">
          <label>
            WebDAV 服务器
            <input
              value={props.config.serverUrl}
              placeholder="https://example.com/webdav"
              onChange={(event) => props.onConfigChange({ ...props.config, serverUrl: event.target.value })}
            />
          </label>
          <label>
            用户名
            <input
              value={props.config.username}
              onChange={(event) => props.onConfigChange({ ...props.config, username: event.target.value })}
            />
          </label>
          <label>
            密码或应用密码
            <input
              type="password"
              value={props.config.password ?? ""}
              onChange={(event) => props.onConfigChange({ ...props.config, password: event.target.value })}
            />
          </label>
          <label>
            远端同步目录
            <input
              value={props.config.remoteDir}
              placeholder="/openmind"
              onChange={(event) => props.onConfigChange({ ...props.config, remoteDir: event.target.value })}
            />
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={props.config.rememberCredentials}
              onChange={(event) => props.onConfigChange({ ...props.config, rememberCredentials: event.target.checked })}
            />
            记住凭据
          </label>
          <p className="settings-note">浏览器直连 WebDAV 需要服务端允许 CORS。记住凭据会把密码保存在浏览器本地存储中，仅适合可信设备。</p>
          <button className="primary" onClick={props.onTestConnection}>测试连接</button>
          {props.testMessage ? <p className="settings-message">{props.testMessage}</p> : null}
        </div>
        <h3>历史备份</h3>
        <div className="backup-list">
          {props.backups.length === 0 ? <p>暂无备份</p> : null}
          {props.backups.map((backup) => (
            <div className="backup-row" key={backup.id}>
              <span>{backup.fileName}</span>
              <span>{backup.source}</span>
              <span>{new Date(backup.createdAt).toLocaleString()}</span>
              <button onClick={() => props.onDownloadBackup(backup)}>下载</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
