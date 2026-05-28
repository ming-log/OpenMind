# OpenMind

<p>
  简体中文 |
  <a href="./README.en.md">English</a> |
  <a href="https://github.com/ming-log/OpenMind">GitHub</a> |
  <a href="https://ming-log.github.io/OpenMind/">在线体验</a>
</p>

OpenMind 是一个本地优先的 Markdown 思维导图工具。它把 Markdown 作为可读、可迁移的源文件，同时提供导图视图、Markdown 编辑、任务管理、主题切换、PNG 导出、WebDAV 同步与动态分享。

在线地址：[https://ming-log.github.io/OpenMind/](https://ming-log.github.io/OpenMind/)

![OpenMind logo](./public/openmind-logo.png)

## 特性

- Markdown 与导图双视图：在可视化导图和 Markdown 源文本之间切换。
- 本地优先：不配置 WebDAV 也可以创建、编辑、导入、导出和恢复内容。
- 多任务管理：在浏览器本地保存多个 Markdown 思维导图任务。
- 节点编辑：支持新增子节点、同级节点、上级节点、删除节点、拖拽移动、框选多选和节点尺寸调整。
- 外框与备注：为选中节点或子树添加外框，并在外框上方直接编辑备注。
- 批注支持 Markdown：节点批注支持段落、列表、加粗、强调、行内代码、图片和代码块等基础 Markdown 渲染。
- PNG / Markdown 导出：导出完整导图图片或 Markdown 文件。
- 主题切换：内置多套导图主题。
- WebDAV 同步：通过浏览器直连 WebDAV，按修改时间同步远端 Markdown。
- 动态分享：可生成基于 WebDAV JSON 的只读分享链接，支持直连公开地址和 OpenList `raw_url` 模式。
- 安全备份：同步覆盖本地或远端内容前，会把被覆盖版本保存到本地备份历史。

## 技术栈

- React 19
- TypeScript
- Vite
- Vitest
- 浏览器 LocalStorage
- Browser-side WebDAV

## 快速开始

```bash
npm install
npm run dev
```

启动后打开 Vite 输出的地址，通常是：

```text
http://127.0.0.1:5173/OpenMind/
```

如果端口被占用，Vite 会自动切换到其他端口。

## 常用命令

```bash
# 开发
npm run dev

# 测试
npm test

# 类型检查
npm run typecheck

# 生产构建
npm run build

# 本地 WebDAV 模拟服务
npm run mock:webdav
```

## Markdown 映射规则

OpenMind 使用标题层级表达导图结构，标题下方正文会成为节点批注。

```markdown
# 根主题

根主题批注。

## 子主题

子主题批注。

### 孙主题

孙主题批注。
```

- `H1` 是根节点。
- `H2` 到 `H6` 会按标题层级解析为子节点。
- 标题下方正文会作为该节点的批注。
- 如果 Markdown 没有 `H1`，会使用文件名创建根节点并显示警告。
- 如果 Markdown 有多个 `H1`，OpenMind 会把后续 `H1` 章节归并到第一个根主题下，并显示警告。

## WebDAV 同步

OpenMind 会直接在浏览器中使用 WebDAV 请求：

- `PROPFIND`
- `GET`
- `PUT`

因此 WebDAV 服务必须允许当前站点跨域访问，并放行相关方法。如果服务端不允许浏览器 CORS，OpenMind 会保留本地内容并显示同步或连接失败提示。

### 本地模拟 WebDAV

```bash
npm run mock:webdav
```

然后在 OpenMind 设置中填写：

- WebDAV 服务器：`http://127.0.0.1:5180`
- 远端同步目录：`/openmind`
- 用户名/密码：可留空

默认模拟服务会把远端文件标记为较新，用于测试拉取和本地备份。测试上传路径可使用：

```powershell
$env:OPENMIND_MOCK_WEBDAV_MODE="local-newer"; npm run mock:webdav
```

## 分享

OpenMind 支持两种只读分享方式：

- 快照分享：把当前导图数据编码进 URL，适合小型导图临时分享。
- 远端分享：把 JSON 发布到 WebDAV，再生成只读链接，适合跨设备和持续更新。

远端分享不会在链接里包含 WebDAV 密码。上传使用你配置的 WebDAV 凭据，访问者通过公开读取地址或 OpenList `raw_url` 读取分享 JSON。

## 数据与安全

- 默认数据保存在浏览器 LocalStorage。
- WebDAV 密码默认不保存。
- 如果启用“记住凭据”，密码会以混淆形式保存到浏览器 LocalStorage。它不是强加密，仅适合可信个人设备。
- 同步覆盖前会创建本地备份，可在设置中下载。

## 项目结构

```text
OpenMind/
├─ src/
│  ├─ components/     # React 组件
│  ├─ domain/         # Markdown、布局、同步、主题等领域逻辑
│  └─ App.tsx         # 应用入口与状态编排
├─ scripts/           # 本地辅助脚本
├─ docs/              # 需求、设计与验收文档
├─ public/            # 静态资源
└─ README.en.md       # 英文 README
```

## 开发说明

提交前建议运行：

```bash
npm test
npm run typecheck
npm run build
```

当前项目没有后端服务依赖，除 WebDAV 同步和动态分享外，核心编辑能力都在浏览器本地完成。

## License

[MIT](./LICENSE)
