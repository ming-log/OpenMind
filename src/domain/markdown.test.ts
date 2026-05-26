import { describe, expect, it } from "vitest";
import { createDefaultDocument, parseMarkdown, serializeMarkdown } from "./markdown";

describe("parseMarkdown", () => {
  it("maps H1-H6 headings into a tree and assigns body text to notes", () => {
    const result = parseMarkdown(`# Root

Root note paragraph.

## Child A

Child note.

### Grandchild

Grandchild note.

## Child B

#### Deep child

Deep note.`, "Imported");

    expect(result.root.title).toBe("Root");
    expect(result.root.note).toBe("Root note paragraph.");
    expect(result.root.children.map((node) => node.title)).toEqual(["Child A", "Child B"]);
    expect(result.root.children[0].children[0].title).toBe("Grandchild");
    expect(result.root.children[1].children[0].title).toBe("Deep child");
    expect(result.root.children[1].children[0].level).toBe(4);
  });

  it("creates a root from the file name when Markdown has no H1", () => {
    const result = parseMarkdown(`Intro paragraph.

## Child

Child note.`, "project-notes.md");

    expect(result.root.title).toBe("project-notes");
    expect(result.root.note).toContain("Intro paragraph.");
    expect(result.warnings).toContain("Markdown has no H1; using file name as root.");
  });

  it("keeps additional H1 sections and reports a warning", () => {
    const result = parseMarkdown(`# Root

Root note.

# Other root

Other root note.

## Included child`, "mind.md");

    expect(result.root.title).toBe("Root");
    expect(result.root.note).toBe("Root note.");
    expect(result.root.children[0].title).toBe("Other root");
    expect(result.root.children[0].note).toBe("Other root note.");
    expect(result.root.children[0].children[0].title).toBe("Included child");
    expect(result.warnings).toContain("Markdown has multiple H1 headings; additional H1 sections were parsed under the first root.");
  });

  it("keeps additional H1 sections and their descendants as mind map nodes", () => {
    const result = parseMarkdown(`# Root

## Root child

# Second root

Second note.

## Second child

### Second grandchild`, "mind.md");

    expect(result.root.title).toBe("Root");
    expect(result.root.children.map((node) => node.title)).toEqual(["Root child", "Second root"]);
    expect(result.root.children[1].note).toBe("Second note.");
    expect(result.root.children[1].children[0].title).toBe("Second child");
    expect(result.root.children[1].children[0].children[0].title).toBe("Second grandchild");
  });
});

describe("serializeMarkdown", () => {
  it("round-trips node titles and notes without serializing runtime ids", () => {
    const document = createDefaultDocument("Root");
    document.root.note = "Root note.";
    document.root.children.push({
      id: "runtime-child",
      title: "Child",
      note: "Child note.",
      level: 2,
      children: [],
    });

    expect(serializeMarkdown(document.root)).toBe(`# Root

Root note.

## Child

Child note.
`);
    expect(serializeMarkdown(document.root)).not.toContain("runtime-child");
  });

  it("persists OpenMind side metadata through Markdown without adding it to notes", () => {
    const document = createDefaultDocument("Root");
    document.root.children.push({
      id: "left-child",
      title: "Left child",
      note: "Visible note.",
      level: 2,
      side: "left",
      children: [],
    });

    const markdown = serializeMarkdown(document.root);
    const parsed = parseMarkdown(markdown, "Root.md");

    expect(markdown).toContain("<!-- openmind:side=left -->");
    expect(parsed.root.children[0]).toMatchObject({
      title: "Left child",
      side: "left",
      note: "Visible note.",
    });
  });
});
