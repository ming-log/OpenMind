import { describe, expect, it } from "vitest";
import appSource from "../App.tsx?raw";
import canvasSource from "./MindMapCanvas.tsx?raw";

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
});
