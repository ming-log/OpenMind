import { describe, expect, it } from "vitest";
import appSource from "../App.tsx?raw";
import canvasSource from "./MindMapCanvas.tsx?raw";

describe("mind map node dialogs", () => {
  it("keeps node editing and deletion out of browser-native dialogs", () => {
    expect(canvasSource).not.toContain("window.prompt");
    expect(canvasSource).not.toContain("window.confirm");
    expect(appSource).not.toContain('window.confirm("删除该节点及全部子节点？")');
  });
});
