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
});
