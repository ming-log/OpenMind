import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import appSource from "../App.tsx?raw";
import canvasSource from "./MindMapCanvas.tsx?raw";
import noteBubbleSource from "./NoteBubble.tsx?raw";

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
    expect(canvasSource).not.toContain("编辑标题\" : \"编辑批注");
  });

  it("supports clearing multi-selection and deleting group frames from the canvas", () => {
    expect(canvasSource).toContain("onClearSelection");
    expect(canvasSource).toContain("group-frame-delete");
    expect(canvasSource).toContain("onDeleteGroupFrame");
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
    expect(canvasSource).toContain("event.clientX - rect.left");
    expect(canvasSource).toContain("event.clientY - rect.top");
    expect(canvasSource).not.toContain("onWheel={(event)");
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
