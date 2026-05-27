import { describe, expect, it } from "vitest";
import { deleteDocumentById } from "./documents";
import type { DocumentState } from "./types";

function documentFixture(id: string): DocumentState {
  return {
    id,
    fileName: `${id}.md`,
    markdown: `# ${id}`,
    root: {
      id: `root-${id}`,
      title: id,
      note: "",
      level: 1,
      children: [],
    },
    groupFrames: [],
    localModifiedAt: "2026-05-27T00:00:00.000Z",
    lastSavedMarkdown: `# ${id}`,
    saveStatus: "saved",
    warnings: [],
  };
}

describe("document collection helpers", () => {
  it("deletes an inactive document while keeping the active document selected", () => {
    const active = documentFixture("active");
    const stale = documentFixture("stale");
    const result = deleteDocumentById([active, stale], "active", "stale");

    expect(result.deleted).toBe(true);
    expect(result.deletedActiveDocument).toBe(false);
    expect(result.documents.map((document) => document.id)).toEqual(["active"]);
    expect(result.activeDocument.id).toBe("active");
  });

  it("deletes the active document and selects the next nearest document", () => {
    const first = documentFixture("first");
    const active = documentFixture("active");
    const next = documentFixture("next");
    const result = deleteDocumentById([first, active, next], "active", "active");

    expect(result.deletedActiveDocument).toBe(true);
    expect(result.documents.map((document) => document.id)).toEqual(["first", "next"]);
    expect(result.activeDocument.id).toBe("next");
  });

  it("creates a fresh fallback document when the last document is deleted", () => {
    const active = documentFixture("active");
    const result = deleteDocumentById([active], "active", "active");

    expect(result.deleted).toBe(true);
    expect(result.deletedActiveDocument).toBe(true);
    expect(result.documents).toHaveLength(1);
    expect(result.activeDocument.id).toBe(result.documents[0].id);
    expect(result.activeDocument.root.title).toBe("OpenMind");
  });
});
