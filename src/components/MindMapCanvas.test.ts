import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import appSource from "../App.tsx?raw";
import pngExportSource from "../domain/pngExport.ts?raw";
import canvasSource from "./MindMapCanvas.tsx?raw";
import noteBubbleSource from "./NoteBubble.tsx?raw";
import settingsSource from "./SettingsModal.tsx?raw";
import themePickerSource from "./ThemePicker.tsx?raw";
import toolbarSource from "./Toolbar.tsx?raw";
import iconsSource from "./Icons.tsx?raw";

const stylesSource = readFileSync(new URL("../styles.css", import.meta.url), "utf-8");

describe("mind map node dialogs", () => {
  it("keeps node editing and deletion out of browser-native dialogs", () => {
    expect(canvasSource).not.toContain("window.prompt");
    expect(canvasSource).not.toContain("window.confirm");
    expect(appSource).not.toContain('window.confirm("删除该节点及全部子节点？")');
  });

  it("gates canvas keyboard shortcuts while overlays are open", () => {
    expect(canvasSource).toContain("titleEditor || noteDrawer || deleteTarget || menu");
    expect(canvasSource).toContain("return;");
  });

  it("uses inline title editing and a side drawer for note editing", () => {
    expect(canvasSource).toContain("node-title-input");
    expect(canvasSource).toContain("note-drawer");
    expect(canvasSource).toContain('document.addEventListener("pointerdown", pointerdown, { capture: true })');
    expect(canvasSource).not.toContain("编辑标题\" : \"编辑批注");
  });

  it("keeps inline title editing multiline and aligned with node text", () => {
    expect(canvasSource).toContain("<textarea");
    expect(canvasSource).toContain("insertTitleLineBreak");
    expect(canvasSource).toContain("event.ctrlKey");
    expect(canvasSource).toContain("calculateNodeHeight({ ...entry.node, title: titleEditor.value }, getNodeDepth(entry))");
    expect(pngExportSource).toContain("NODE_WIDTH = 270");
    expect(pngExportSource).toContain("NODE_AUTO_MAX_WIDTH = 420");
    expect(stylesSource).toMatch(/\.mind-node\s*\{[^}]*max-width:\s*720px/);
    expect(stylesSource).toMatch(/\.mind-node strong\s*\{[^}]*white-space:\s*pre-wrap/);
    expect(stylesSource).toMatch(/\.node-title-input\s*\{[^}]*background:\s*transparent/);
    expect(stylesSource).toMatch(/\.node-title-input\s*\{[^}]*resize:\s*none/);
  });

  it("renders transparent lower nodes as text-width labels with an underline", () => {
    const globalNodeTitleRuleIndex = stylesSource.indexOf(".mind-node strong");
    const lowerNodeTitleRuleIndex = stylesSource.indexOf(".mind-node:not(.level-1):not([data-node-depth=\"1\"]) strong", globalNodeTitleRuleIndex);

    expect(stylesSource).toContain(".mind-node:not(.level-1):not([data-node-depth=\"1\"]) strong");
    expect(lowerNodeTitleRuleIndex).toBeGreaterThan(globalNodeTitleRuleIndex);
    expect(stylesSource).toContain("width: 100%");
    expect(stylesSource).toMatch(/\.mind-node:not\(\.level-1\):not\(\[data-node-depth="1"\]\)\s*\{[^}]*padding:\s*0;/);
    expect(stylesSource).toContain("border-bottom: 1px solid var(--edge)");
    expect(stylesSource).toContain("border-bottom-color: var(--edge-left)");
    expect(stylesSource).toContain("border-bottom-color: var(--edge-right)");
    expect(stylesSource).toContain(".mind-node:not(.level-1):not([data-node-depth=\"1\"]).selected");
    expect(stylesSource).toContain("box-shadow: 0 2px 0 var(--accent)");
    expect(pngExportSource).toContain("estimateTextNodeWidth");
    expect(canvasSource).toContain("getNodeLayoutWidth");
    expect(canvasSource).toContain("width: getRenderedNodeWidth(entry)");
    expect(canvasSource).toContain("getConnectorX(childEntry");
    expect(canvasSource).toContain("NOTE_MARK_SPACE");
    expect(pngExportSource).toContain("NODE_AUTO_MAX_WIDTH");
    expect(pngExportSource).toContain("getNodeAutoWidth");
    expect(canvasSource).toContain('data-has-note={entry.node.note.trim() ? "true" : "false"}');
    expect(stylesSource).toContain('.mind-node:not(.level-1):not([data-node-depth="1"]) .note-dot');
    expect(stylesSource).toContain('[data-has-note="true"] strong');
    expect(iconsSource).toContain('className="note-dot-icon"');
    expect(iconsSource).toContain('<path d="M14 3H7');
  });

  it("supports clearing multi-selection and deleting selected group frames with Delete", () => {
    expect(canvasSource).toContain("onClearSelection");
    expect(canvasSource).toContain("selectedFrameId");
    expect(canvasSource).toContain("props.onDeleteGroupFrame(selectedFrameId)");
    expect(canvasSource).toContain("onDeleteGroupFrame");
    expect(canvasSource).not.toContain("group-frame-delete");
  });

  it("auto-pulls configured WebDAV content and keeps the selection box as a transparent dashed frame", () => {
    expect(appSource).toContain("autoPullStartedRef");
    expect(appSource).toContain("pullRemoteDocument");
    expect(appSource).toContain("pullRemoteHistory");
    expect(appSource).toContain("listRemoteMarkdownFiles");
    expect(appSource).toContain("downloadRemoteMarkdown");
    expect(appSource).toContain('mode: "pull"');
    expect(settingsSource).toContain("测试连接并拉取历史");
    expect(stylesSource).toMatch(/\.selection-box\s*\{[^}]*border:\s*1px dashed rgba\(79,\s*70,\s*229,\s*0\.78\)/);
    expect(stylesSource).toMatch(/\.selection-box\s*\{[^}]*background:\s*rgba\(79,\s*70,\s*229,\s*0\.1\)/);
  });

  it("keeps theme selection collapsed on the map instead of inside settings", () => {
    expect(canvasSource).toContain("ThemePicker");
    expect(themePickerSource).toContain("theme-dock");
    expect(themePickerSource).toContain("theme-dock-toggle");
    expect(themePickerSource).toContain("aria-expanded={open}");
    expect(themePickerSource).toContain("PaletteIcon");
    expect(themePickerSource).toContain("theme-swatch-grid");
    expect(stylesSource).toMatch(/\.theme-dock\s*\{[^}]*right:\s*16px/);
    expect(stylesSource).toContain(".theme-dock-panel");
    expect(appSource).toContain("onThemeChange={setThemeId}");
    expect(settingsSource).not.toContain("themeId");
    expect(settingsSource).not.toContain("主题外观");
  });

  it("frames only the root and first-level components in the themed map", () => {
    expect(canvasSource).toContain("data-node-depth");
    expect(canvasSource).toContain("nodeDepths");
    expect(stylesSource).toMatch(/\.mind-node\s*\{[^}]*background:\s*transparent/);
    expect(stylesSource).toContain('.mind-node[data-node-depth="1"]');
    expect(stylesSource).toContain('.mind-node[data-node-depth="1"][data-branch-side="left"]');
    expect(stylesSource).toContain('.mind-node:not(.level-1):not([data-node-depth="1"]):hover');
    expect(pngExportSource).toContain("const framed = entry.node.id === root.id || nodeDepth === 1");
  });

  it("keeps node creation in the canvas toolbar instead of floating plus buttons", () => {
    expect(canvasSource).toContain("AddChildNodeIcon");
    expect(canvasSource).toContain("AddSiblingNodeIcon");
    expect(canvasSource).toContain("AddParentNodeIcon");
    expect(canvasSource).toContain("onAddParent");
    expect(canvasSource).toContain("canUseNodeTools");
    expect(canvasSource).toContain("canAddSibling");
    expect(canvasSource).toContain("canAddParent");
    expect(canvasSource).not.toContain("node-add");
    expect(stylesSource).not.toContain(".node-add");
    expect(appSource).toContain("addParentNode");
  });

  it("draws group frames around selected nodes and allows single-node frames", () => {
    const groupFrameNoteStyles = stylesSource.match(/\.group-frame-note\s*\{[^}]*\}/)?.[0] ?? "";

    expect(canvasSource).toContain("getFrameLayout");
    expect(canvasSource).toContain("data-frame-side={layout.side}");
    expect(canvasSource).toContain("GROUP_FRAME_PADDING_X = 30");
    expect(canvasSource).toContain("estimateGroupFrameTopReserve");
    expect(canvasSource).toContain("reserveRootsByParent");
    expect(canvasSource).toContain("siblingIndexById");
    expect(canvasSource).toContain("topLevelById");
    expect(canvasSource).toContain("getFrameTopReserve");
    expect(canvasSource).toContain("estimateGroupFrameTopReserve(currentFrame.note) + nestedReserve");
    expect(canvasSource).toContain("reserves.set(topLevelId");
    expect(canvasSource).toContain("layoutTree(props.root, { topReserves: frameTopReserves })");
    expect(canvasSource).toContain("selectedHasGroupFrame");
    expect(canvasSource).toContain("title={selectedHasGroupFrame ? \"取消选中节点外框\" : \"为选中节点添加外框\"}");
    expect(canvasSource).toContain("childIsInsideFrame");
    expect(canvasSource).toContain("getFrameLayout(childFrame, nextVisitedFrameIds)");
    expect(canvasSource).toContain("second.nodeIds.length - first.nodeIds.length");
    expect(canvasSource).toContain("input.setSelectionRange(end, end)");
    expect(canvasSource).not.toContain("input.select()");
    expect(canvasSource).toContain("right - left + paddingX * 2");
    expect(canvasSource).toContain("props.selectedIds.length");
    expect(stylesSource).toContain("border: 1.5px dashed");
    expect(stylesSource).toContain("background: rgba(187, 247, 208, 0.16)");
    expect(stylesSource).toContain(".group-frame-box");
    expect(stylesSource).toContain(".group-frame.selected .group-frame-box");
    expect(canvasSource).toContain("labelStyle");
    expect(canvasSource).toContain("boxStyle");
    expect(canvasSource).toContain("group-frame-note-input");
    expect(canvasSource).toContain("onBlur={saveFrameEdit}");
    expect(canvasSource).not.toContain("<span>外框备注</span>");
    expect(canvasSource).not.toContain("<strong>编辑备注</strong>");
    expect(canvasSource).toContain("const labelWidth = frameWidth * 0.9");
    expect(canvasSource).toContain("width: labelWidth");
    expect(canvasSource).toContain("labelHeight");
    expect(canvasSource).toContain("GROUP_FRAME_LABEL_GAP = 2");
    expect(canvasSource).toContain("const boxHeight = bottom - top + paddingTop + paddingBottom");
    expect(canvasSource).not.toContain("overlappingNodeTop");
    expect(stylesSource).toContain("left: 50%");
    expect(stylesSource).toContain("transform: translateX(-50%)");
    expect(stylesSource).toContain("box-sizing: border-box");
    expect(stylesSource).toContain("overflow-wrap: anywhere");
    expect(stylesSource).toContain("white-space: normal");
    expect(groupFrameNoteStyles).not.toContain("text-overflow: ellipsis");
    expect(groupFrameNoteStyles).not.toContain("overflow: hidden");
    expect(stylesSource).not.toContain(".group-frame-brace");
    expect(stylesSource).not.toContain(".group-frame-delete");
    expect(appSource).toContain("!uniqueIds.length");
    expect(appSource).toContain("sortedFrameNodeIds");
    expect(appSource).toContain("filter((frame) => !sameFrameSet(frame))");
    expect(appSource).toContain("commitGroupFrames(groupFrames, \"已取消外框\")");
    expect(appSource).toContain("serializeMarkdown(documentState.root, groupFrames)");
  });

  it("supports blank-canvas panning and clearing every selected node", () => {
    expect(canvasSource).toContain("isCanvasSurfaceTarget");
    expect(canvasSource).toContain("clearSelectionOnClick");
    expect(canvasSource).toContain("CLICK_DRAG_THRESHOLD");
    expect(canvasSource).toContain("props.onClearSelection()");
    expect(canvasSource).toContain("setPinnedNoteId(null)");
  });

  it("keeps note preview bubbles reachable above neighboring nodes", () => {
    const noteBubbleHoverStyles = stylesSource.match(/\.note-bubble\.hover\s*\{[^}]*\}/)?.[0] ?? "";

    expect(stylesSource).toContain(".note-bubble.hover:hover");
    expect(stylesSource).toContain(".note-dot:hover ~ .note-bubble.hover");
    expect(stylesSource).not.toContain(".mind-node:hover .note-bubble.hover");
    expect(stylesSource).toContain("visibility 0s linear 0.36s");
    expect(stylesSource).toContain("z-index: 120");
    expect(stylesSource).toMatch(/\.mind-node:hover\s*\{[^}]*z-index:\s*40/);
    expect(noteBubbleHoverStyles).not.toContain("display: none");
  });

  it("supports document undo through Ctrl+Z", () => {
    expect(appSource).toContain("undoStacksRef");
    expect(appSource).toContain("undoLastChange");
    expect(appSource).toContain('event.key.toLowerCase() === "z"');
  });

  it("supports deleting tasks from the sidebar without a browser-native confirm", () => {
    expect(appSource).toContain("requestDeleteTask");
    expect(appSource).toContain("confirmDeleteTask");
    expect(appSource).toContain("task-delete");
    expect(appSource).not.toContain("window.confirm");
  });

  it("uses a lightweight node-only drag preview without recentering after drop", () => {
    const dragPreviewStyles = stylesSource.match(/\.mind-node\.drag-preview\s*\{[^}]*\}/)?.[0] ?? "";

    expect(canvasSource).toContain("dragPreviewRef");
    expect(canvasSource).toContain("scheduleNodeDragPreview");
    expect(canvasSource).toContain("getDragIntentPoint");
    expect(canvasSource).toContain("pointerOffsetY");
    expect(canvasSource).toContain("translate3d");
    expect(canvasSource).toContain("drag-preview");
    expect(canvasSource).toContain("drag-source");
    expect(canvasSource).not.toContain("nodeDragOffset");
    expect(canvasSource).not.toContain("pendingCenterRef");
    expect(dragPreviewStyles).toContain("will-change: transform");
    expect(dragPreviewStyles).toContain("transition: opacity 0.12s linear, box-shadow 0.12s linear;");
    expect(dragPreviewStyles).not.toContain("transition: var(--transition)");
  });

  it("keeps wheel zoom anchored to the pointer instead of the canvas origin", () => {
    expect(canvasSource).toContain("calculatePanForZoomAtPoint");
    expect(canvasSource).toContain("zoomAtViewportPoint");
    expect(canvasSource).toContain('document.addEventListener("wheel", wheel, { capture: true, passive: false })');
    expect(canvasSource).toContain("event.clientX - rect.left");
    expect(canvasSource).toContain("event.clientY - rect.top");
    expect(canvasSource).toContain("event.preventDefault()");
    expect(canvasSource).toContain("event.stopPropagation()");
    expect(canvasSource).not.toContain("onWheel={(event)");
  });

  it("supports plain wheel vertical panning without changing zoom", () => {
    expect(canvasSource).toContain("plainWheel");
    expect(canvasSource).toContain("panViewportVertically");
    expect(canvasSource).toContain("normalizeWheelDeltaY");
    expect(canvasSource).toContain("!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey");
    expect(canvasSource).toContain("setPan(nextPan)");
  });

  it("lets note bubbles consume plain wheel scrolling before canvas panning", () => {
    expect(canvasSource).toContain("isNoteScrollTarget");
    expect(canvasSource).toContain('closest(".note-bubble, .note-drawer-content")');
    expect(canvasSource).toContain("if (plainWheel && isNoteScrollTarget(event.target))");
  });

  it("supports resizing nodes from border handles", () => {
    expect(canvasSource).toContain("RESIZE_HANDLES");
    expect(canvasSource).toContain("node-resize-handle");
    expect(canvasSource).toContain("startNodeResize");
    expect(canvasSource).toContain("calculateResizeDraft");
    expect(canvasSource).toContain("props.onResizeNode");
    expect(canvasSource).toContain("NODE_MAX_WIDTH");
    expect(stylesSource).toContain(".node-resize-handle");
    expect(stylesSource).toContain("cursor: nwse-resize");
    expect(stylesSource).toContain("cursor: ew-resize");
    expect(stylesSource).toContain("cursor: ns-resize");
  });

  it("keeps note vector icons and text-only component spacing tied to theme colors", () => {
    expect(stylesSource).toContain(".mind-node[data-branch-side=\"left\"] .note-dot");
    expect(stylesSource).toContain("color: var(--edge-left)");
    expect(stylesSource).toContain("color: var(--edge-right)");
    expect(stylesSource).toContain("padding: 0 9px 3px");
    expect(pngExportSource).toContain("TEXT_NODE_HORIZONTAL_PADDING = 18");
  });

  it("closes the note drawer with Escape and switches drawer content on node clicks", () => {
    expect(canvasSource).toContain('event.key !== "Escape"');
    expect(canvasSource).toContain("syncOpenNoteDrawer(entry.node)");
  });

  it("normalizes imported Markdown with multiple H1 headings before saving it", () => {
    expect(appSource).toContain("MULTIPLE_H1_NORMALIZED_WARNING");
    expect(appSource).toContain("importedMarkdown");
    expect(appSource).toContain("serializeMarkdown(parsed.root)");
  });

  it("supports focus mode and image zoom affordances", () => {
    expect(appSource).toContain("focusMode");
    expect(canvasSource).toContain("onFocusModeChange");
    expect(canvasSource).toContain("进入专注模式");
    expect(iconsSource).toContain("m8 8-5-5");
  });

  it("uses clearer icons for auto layout, focus mode, and sharing", () => {
    expect(canvasSource).toContain("AutoLayoutIcon");
    expect(canvasSource).not.toContain("FitIcon");
    expect(iconsSource).toContain("export function AutoLayoutIcon");
    expect(iconsSource).toContain('<rect height="4" rx="1.2" width="6" x="9" y="3"');
    expect(iconsSource).toContain("export function ShareIcon");
    expect(toolbarSource).toContain("ShareIcon");
    expect(toolbarSource).toContain("生成动态只读分享");
  });

  it("supports cross-device dynamic remote share links and local live previews", () => {
    expect(appSource).toContain("parseAppRoute");
    expect(appSource).toContain("createShareUrl");
    expect(appSource).toContain("createRemoteShareUrl");
    expect(appSource).toContain("createRemoteShareTarget");
    expect(appSource).toContain("createPublicShareRemoteUrl");
    expect(appSource).toContain("fetchOpenListShareText");
    expect(appSource).toContain("verifyPublicShareReadable");
    expect(appSource).toContain("createSharePayload");
    expect(appSource).toContain("decodeSharePayload");
    expect(appSource).toContain("decodeRemoteShareTarget");
    expect(appSource).toContain("share-data");
    expect(appSource).toContain("share-remote");
    expect(appSource).toContain("SharePage");
    expect(appSource).toContain("openSharePage");
    expect(appSource).toContain("window.open(shareUrl");
    expect(appSource).toContain("动态只读分享");
    expect(appSource).toContain("只读本机预览");
    expect(appSource).toContain("window.setInterval(refreshRemoteShare, 3000)");
    expect(appSource).toContain("publishShareDocument");
    expect(settingsSource).toContain("访客分享读取地址");
    expect(settingsSource).toContain("OpenList raw_url 模式");
    expect(settingsSource).toContain("分享链接不会包含你的 WebDAV 密码");
    expect(appSource).toContain('window.addEventListener("storage", refreshSharedState)');
    expect(appSource).toContain("window.setInterval(refreshSharedState, 1000)");
    expect(canvasSource).toContain("readOnly");
    expect(canvasSource).toContain("props.shortcutsDisabled || props.readOnly");
    expect(canvasSource).toContain("!props.readOnly ? <ThemePicker");
  });

  it("keeps image previews centered and isolated from node click bubbling", () => {
    expect(noteBubbleSource).toContain('event.key === "Escape"');
    expect(noteBubbleSource).toContain("event.stopPropagation()");
    expect(noteBubbleSource).toContain("image-preview-backdrop");
    expect(noteBubbleSource).toContain("createPortal");
  });

  it("supports gallery thumbnails and keyboard navigation for multiple note images", () => {
    expect(noteBubbleSource).toContain("galleryImages");
    expect(noteBubbleSource).toContain("image-preview-thumbs");
    expect(noteBubbleSource).toContain("ArrowRight");
    expect(noteBubbleSource).toContain("ArrowDown");
    expect(noteBubbleSource).toContain("ArrowLeft");
    expect(noteBubbleSource).toContain("ArrowUp");
    expect(stylesSource).toContain("grid-template-columns: 128px minmax(0, 1fr)");
    expect(stylesSource).toContain("height: 100vh");
  });
});
