import { describe, expect, it } from "vitest";
import { createDefaultDocument, MULTIPLE_H1_NORMALIZED_WARNING, parseMarkdown, serializeMarkdown } from "./markdown";

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

  it("wraps multiple H1 sections under a new root topic", () => {
    const result = parseMarkdown(`# Root

Root note.

# Other root

Other root note.

## Included child`, "mind.md");

    expect(result.root.title).toBe("根主题");
    expect(result.root.level).toBe(1);
    expect(result.root.children.map((node) => node.title)).toEqual(["Root", "Other root"]);
    expect(result.root.children[0]).toMatchObject({ title: "Root", note: "Root note.", level: 2 });
    expect(result.root.children[1]).toMatchObject({ title: "Other root", note: "Other root note.", level: 2 });
    expect(result.root.children[1].children[0]).toMatchObject({ title: "Included child", level: 3 });
    expect(result.warnings).toContain(MULTIPLE_H1_NORMALIZED_WARNING);
  });

  it("raises every heading level when wrapping multiple H1 imports", () => {
    const result = parseMarkdown(`# Root

## Root child

# Second root

Second note.

## Second child

### Second grandchild`, "mind.md");

    expect(result.root.title).toBe("根主题");
    expect(result.root.children.map((node) => [node.title, node.level])).toEqual([
      ["Root", 2],
      ["Second root", 2],
    ]);
    expect(result.root.children[0].children[0]).toMatchObject({ title: "Root child", level: 3 });
    expect(result.root.children[1].note).toBe("Second note.");
    expect(result.root.children[1].children[0]).toMatchObject({ title: "Second child", level: 3 });
    expect(result.root.children[1].children[0].children[0]).toMatchObject({ title: "Second grandchild", level: 4 });
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

  it("persists OpenMind node size metadata through Markdown without adding it to notes", () => {
    const document = createDefaultDocument("Root");
    document.root.children.push({
      id: "sized-child",
      title: "Sized child",
      note: "Visible note.",
      level: 2,
      size: { width: 240, height: 96 },
      children: [],
    });

    const markdown = serializeMarkdown(document.root);
    const parsed = parseMarkdown(markdown, "Root.md");

    expect(markdown).toContain("<!-- openmind:size=240x96 -->");
    expect(parsed.root.children[0]).toMatchObject({
      title: "Sized child",
      size: { width: 240, height: 96 },
      note: "Visible note.",
    });
  });

  it("persists manual title line breaks in heading text", () => {
    const document = createDefaultDocument("Root");
    document.root.children.push({
      id: "multi-line-child",
      title: "First line\nSecond line",
      note: "",
      level: 2,
      children: [],
    });

    const markdown = serializeMarkdown(document.root);
    const parsed = parseMarkdown(markdown, "Root.md");

    expect(markdown).toContain("## First line<br>Second line");
    expect(parsed.root.children[0].title).toBe("First line\nSecond line");
  });
});
