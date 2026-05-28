import { describe, expect, it } from "vitest";
import { calculateNodeHeight, estimateTextNodeWidth, EXPORT_FONT_FAMILY, getNodeLayoutWidth, layoutTree, NODE_AUTO_MAX_WIDTH, NODE_MAX_WIDTH, NODE_WIDTH, wrapCanvasTextLines } from "./pngExport";
import pngExportSource from "./pngExport.ts?raw";
import type { MindNode } from "./types";

function createMeasureContext(): Pick<CanvasRenderingContext2D, "measureText"> {
  return {
    measureText(text: string) {
      const width = Array.from(text).reduce((sum, char) => (
        sum + (/[\u0000-\u00ff]/.test(char) ? 7 : 15)
      ), 0);

      return { width } as TextMetrics;
    },
  };
}

describe("layoutTree", () => {
  it("aligns the root with first-level nodes on both sides", () => {
    const root: MindNode = {
      id: "root",
      title: "Root",
      note: "",
      level: 1,
      children: [
        {
          id: "left",
          title: "Left",
          note: "",
          level: 2,
          side: "left",
          children: [],
        },
        {
          id: "right",
          title: "Right",
          note: "",
          level: 2,
          side: "right",
          children: [
            { id: "right-a", title: "Right A", note: "", level: 3, side: "right", children: [] },
            { id: "right-b", title: "Right B", note: "", level: 3, side: "right", children: [] },
          ],
        },
      ],
    };

    const byId = new Map(layoutTree(root).map((entry) => [entry.node.id, entry]));

    const rootEntry = byId.get("root");
    const leftEntry = byId.get("left");
    const rightEntry = byId.get("right");

    expect(leftEntry && rootEntry ? leftEntry.y + leftEntry.height / 2 : undefined)
      .toBe(rootEntry ? rootEntry.y + rootEntry.height / 2 : undefined);
    expect(rightEntry && rootEntry ? rightEntry.y + rightEntry.height / 2 : undefined)
      .toBe(rootEntry ? rootEntry.y + rootEntry.height / 2 : undefined);
  });

  it("keeps vertical spacing between sibling components compact", () => {
    const root: MindNode = {
      id: "root",
      title: "Root",
      note: "",
      level: 1,
      children: [
        { id: "first", title: "First", note: "", level: 2, side: "right", children: [] },
        { id: "second", title: "Second", note: "", level: 2, side: "right", children: [] },
      ],
    };

    const byId = new Map(layoutTree(root).map((entry) => [entry.node.id, entry]));
    const first = byId.get("first");
    const second = byId.get("second");

    expect(first && second ? second.y - (first.y + first.height) : undefined).toBe(24);
  });

  it("uses a shorter horizontal step for text-only descendants after first-level nodes", () => {
    const root: MindNode = {
      id: "root",
      title: "Root",
      note: "",
      level: 1,
      children: [
        {
          id: "section",
          title: "Section",
          note: "",
          level: 2,
          side: "right",
          children: [
            {
              id: "component",
              title: "Component",
              note: "",
              level: 3,
              side: "right",
              children: [
                { id: "leaf", title: "Leaf", note: "", level: 4, side: "right", children: [] },
              ],
            },
          ],
        },
      ],
    };

    const byId = new Map(layoutTree(root).map((entry) => [entry.node.id, entry]));
    const section = byId.get("section");
    const component = byId.get("component");
    const leaf = byId.get("leaf");

    expect(section && component ? component.x - section.x : undefined).toBe(NODE_WIDTH + 28);
    expect(component && leaf ? leaf.x - component.x : undefined).toBeCloseTo(estimateTextNodeWidth("Component") + 28);
  });

  it("keeps two-character text labels wide enough for one line plus side padding", () => {
    expect(estimateTextNodeWidth("测试")).toBe(46);
  });

  it("grows framed node width with text up to the automatic wrapping width", () => {
    const shortNode: MindNode = {
      id: "short",
      title: "短标题",
      note: "",
      level: 2,
      children: [],
    };
    const mediumNode: MindNode = {
      id: "medium",
      title: "这是一个明显更长一点的一级组件标题展示宽度",
      note: "",
      level: 2,
      children: [],
    };
    const veryLongNode: MindNode = {
      id: "long",
      title: "这是一个特别特别长的一级组件标题，用来确认自动宽度到达上限之后会通过换行增加高度",
      note: "",
      level: 2,
      children: [],
    };

    expect(getNodeLayoutWidth(shortNode, 1)).toBe(NODE_WIDTH);
    expect(getNodeLayoutWidth(mediumNode, 1)).toBeGreaterThan(NODE_WIDTH);
    expect(getNodeLayoutWidth(veryLongNode, 1)).toBe(NODE_AUTO_MAX_WIDTH);
    expect(calculateNodeHeight(veryLongNode, 1, NODE_AUTO_MAX_WIDTH)).toBeGreaterThan(calculateNodeHeight(shortNode, 1, NODE_WIDTH));
  });

  it("allows manual node width to exceed the automatic wrapping width while keeping a hard resize cap", () => {
    const manuallySizedNode: MindNode = {
      id: "manual",
      title: "Manual size",
      note: "",
      level: 2,
      size: { width: NODE_AUTO_MAX_WIDTH + 120, height: 90 },
      children: [],
    };
    const overSizedNode: MindNode = {
      ...manuallySizedNode,
      size: { width: NODE_MAX_WIDTH + 100, height: 90 },
    };

    expect(getNodeLayoutWidth(manuallySizedNode, 1)).toBe(NODE_AUTO_MAX_WIDTH + 120);
    expect(getNodeLayoutWidth(overSizedNode, 1)).toBe(NODE_MAX_WIDTH);
  });

  it("increases node height for long titles", () => {
    expect(calculateNodeHeight({
      id: "long",
      title: "完整开发流程：使用 Codex 开发一个思维导图软件并持续优化布局交互和导出效果",
      note: "",
      level: 2,
      children: [],
    })).toBeGreaterThan(calculateNodeHeight({
      id: "short",
      title: "基本需求",
      note: "",
      level: 2,
      children: [],
    }));
  });

  it("uses the application font stack for PNG text export", () => {
    expect(EXPORT_FONT_FAMILY).toBe('"Times New Roman", "Microsoft YaHei", serif');
    expect(pngExportSource).not.toContain("Georgia");
  });

  it("wraps Chinese titles without whitespace for PNG export", () => {
    const context = createMeasureContext();
    const title = "这是一个没有空格的超长中文节点标题";
    const lines = wrapCanvasTextLines(context, title, 60);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe(title);
    expect(lines.every((line) => context.measureText(line).width <= 60)).toBe(true);
  });

  it("keeps normal English words together before falling back to new lines", () => {
    const context = createMeasureContext();

    expect(wrapCanvasTextLines(context, "alpha beta gamma delta", 70))
      .toEqual(["alpha beta", "gamma", "delta"]);
  });

  it("breaks long single-word titles when they exceed the PNG node width", () => {
    const context = createMeasureContext();
    const title = "supercalifragilistic";
    const lines = wrapCanvasTextLines(context, title, 35);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe(title);
    expect(lines.every((line) => context.measureText(line).width <= 35)).toBe(true);
  });

  it("clips overflowing PNG title lines with an ellipsis", () => {
    const context = createMeasureContext();
    const lines = wrapCanvasTextLines(context, "这是一个没有空格的超长中文节点标题", 45, 2);

    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("...")).toBe(true);
    expect(lines.every((line) => context.measureText(line).width <= 45)).toBe(true);
  });

  it("uses the shared wrapping helper when drawing PNG node titles", () => {
    expect(pngExportSource).toContain("wrapCanvasTextLines(context, text, maxWidth, maxLines)");
    expect(pngExportSource).not.toContain("text.split(/\\s+/)");
  });
});
