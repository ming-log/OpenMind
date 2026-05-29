import { useState } from "react";
import type { BackupEntry, WebDavConfig } from "../domain/types";
import { EyeIcon, EyeOffIcon, XIcon } from "./Icons";

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
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="settings-modal">
        <header>
          <h2>设置</h2>
          <button aria-label="关闭设置" onClick={props.onClose} type="button"><XIcon /></button>
        </header>
        <h3>同步</h3>
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
            <span className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                value={props.config.password ?? ""}
                onChange={(event) => props.onConfigChange({ ...props.config, password: event.target.value })}
              />
              <button
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                aria-pressed={showPassword}
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                title={showPassword ? "隐藏密码" : "显示密码"}
                type="button"
              >
                {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
              </button>
            </span>
          </label>
          <label>
            远端同步目录
            <input
              value={props.config.remoteDir}
              placeholder="/openmind"
              onChange={(event) => props.onConfigChange({ ...props.config, remoteDir: event.target.value })}
            />
          </label>
          <label>
            访客分享读取地址
            <input
              value={props.config.publicShareBaseUrl ?? ""}
              placeholder="https://example.com/public/openmind 或 https://openlist.example.com"
              onChange={(event) => props.onConfigChange({ ...props.config, publicShareBaseUrl: event.target.value })}
            />
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={props.config.publicShareProvider === "openlist"}
              onChange={(event) => props.onConfigChange({
                ...props.config,
                publicShareProvider: event.target.checked ? "openlist" : "direct",
              })}
            />
            OpenList raw_url 模式
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={props.config.rememberCredentials}
              onChange={(event) => props.onConfigChange({ ...props.config, rememberCredentials: event.target.checked })}
            />
            记住凭据
          </label>
          <p className="settings-note">浏览器直连 WebDAV 需要服务端允许 CORS。测试连接会扫描远端同步目录并拉取历史 Markdown 思维导图。动态分享会用你的 WebDAV 凭据上传 JSON；直连模式会匿名读取“访客分享读取地址”里的同名文件，OpenList raw_url 模式只使用访客地址的域名，固定 POST 到 /api/fs/get，用“远端同步目录 + 文件名”换取 raw_url 后读取 JSON。分享链接不会包含你的 WebDAV 密码。</p>
          <button className="primary" onClick={props.onTestConnection}>测试连接并拉取历史</button>
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
