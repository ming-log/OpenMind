import { describe, expect, it } from "vitest";
import { parseNoteMarkdown } from "./noteMarkdown";

describe("parseNoteMarkdown", () => {
  it("renders paragraphs, emphasis, strong text, code, and lists as structured tokens", () => {
    expect(parseNoteMarkdown("A **strong** and *soft* `code` note.\n\n- first\n- second")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", text: "A " },
          { type: "strong", text: "strong" },
          { type: "text", text: " and " },
          { type: "em", text: "soft" },
          { type: "text", text: " " },
          { type: "code", text: "code" },
          { type: "text", text: " note." },
        ],
      },
      {
        type: "list",
        items: [
          [{ type: "text", text: "first" }],
          [{ type: "text", text: "second" }],
        ],
      },
    ]);
  });

  it("renders fenced code blocks and markdown images as structured blocks", () => {
    expect(parseNoteMarkdown("![Diagram](https://example.com/a.png)\n\n```ts\nconst value = 1;\n```")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "image", alt: "Diagram", src: "https://example.com/a.png" },
        ],
      },
      {
        type: "codeBlock",
        language: "ts",
        code: "const value = 1;",
      },
    ]);
  });

  it("renders links, blockquotes, and markdown tables as structured blocks", () => {
    expect(parseNoteMarkdown(`[OpenAI](https://openai.com)

> quoted note

| 维度 | 说明 |
| --- | --- |
| 链接 | [文档](https://example.com) |`)).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "link", text: "OpenAI", href: "https://openai.com" },
        ],
      },
      {
        type: "blockquote",
        children: [{ type: "text", text: "quoted note" }],
      },
      {
        type: "table",
        header: [
          [{ type: "text", text: "维度" }],
          [{ type: "text", text: "说明" }],
        ],
        rows: [
          [
            [{ type: "text", text: "链接" }],
            [{ type: "link", text: "文档", href: "https://example.com" }],
          ],
        ],
      },
    ]);
  });
});
