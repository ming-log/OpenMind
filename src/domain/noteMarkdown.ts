export type InlineToken =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "em"; text: string }
  | { type: "code"; text: string };

export type NoteBlock =
  | { type: "paragraph"; children: InlineToken[] }
  | { type: "list"; items: InlineToken[][] };

export function parseNoteMarkdown(markdown: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  const chunks = markdown
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line))) {
      blocks.push({
        type: "list",
        items: lines.map((line) => parseInline(line.replace(/^[-*]\s+/, ""))),
      });
    } else {
      blocks.push({ type: "paragraph", children: parseInline(lines.join(" ")) });
    }
  }

  return blocks;
}

function parseInline(input: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > cursor) {
      tokens.push({ type: "text", text: input.slice(cursor, match.index) });
    }
    if (match[2]) {
      tokens.push({ type: "strong", text: match[2] });
    } else if (match[3]) {
      tokens.push({ type: "code", text: match[3] });
    } else if (match[4]) {
      tokens.push({ type: "em", text: match[4] });
    }
    cursor = match.index + match[0].length;
  }

  if (cursor < input.length) {
    tokens.push({ type: "text", text: input.slice(cursor) });
  }

  return tokens;
}
