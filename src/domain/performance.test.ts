import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./markdown";
import { layoutTree } from "./pngExport";

describe("500 node support", () => {
  it("parses and lays out a 500 node Markdown mind map", () => {
    const lines = ["# Root", "", "Root note."];
    for (let index = 1; index <= 500; index += 1) {
      lines.push("", `## Node ${index}`, "", `Note ${index}`);
    }

    const startedAt = performance.now();
    const parsed = parseMarkdown(lines.join("\n"), "large.md");
    const positioned = layoutTree(parsed.root);
    const elapsedMs = performance.now() - startedAt;

    expect(parsed.root.children).toHaveLength(500);
    expect(positioned).toHaveLength(501);
    expect(new Set(positioned.map((entry) => entry.node.id)).size).toBe(501);
    expect(elapsedMs).toBeLessThan(250);
  });
});
