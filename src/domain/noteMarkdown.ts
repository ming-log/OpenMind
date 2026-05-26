export type InlineToken =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "em"; text: string }
  | { type: "code"; text: string }
  | { type: "image"; alt: string; src: string };

export type NoteBlock =
  | { type: "paragraph"; children: InlineToken[] }
  | { type: "list"; items: InlineToken[][] }
  | { type: "codeBlock"; language: string; code: string };

export function parseNoteMarkdown(markdown: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  const normalized = markdown.replace(/\r\n/g, "\n");
  const chunks: string[] = [];
  let buffer: string[] = [];
  let inFence = false;

  for (const line of normalized.split("\n")) {
    if (/^```/.test(line.trim())) {
      if (inFence) {
        buffer.push(line);
        chunks.push(buffer.join("\n"));
        buffer = [];
        inFence = false;
      } else {
        if (buffer.some((entry) => entry.trim())) {
          chunks.push(buffer.join("\n"));
          buffer = [];
        }
        buffer.push(line);
        inFence = true;
      }
      continue;
    }

    if (!inFence && !line.trim()) {
      if (buffer.some((entry) => entry.trim())) {
        chunks.push(buffer.join("\n"));
        buffer = [];
      }
      continue;
    }

    buffer.push(line);
  }

  if (buffer.some((entry) => entry.trim())) {
    chunks.push(buffer.join("\n"));
  }

  for (const chunk of chunks) {
    const fence = /^```\s*([A-Za-z0-9_-]*)\s*\n([\s\S]*?)\n?```\s*$/.exec(chunk.trim());
    if (fence) {
      blocks.push({
        type: "codeBlock",
        language: fence[1] ?? "",
        code: fence[2] ?? "",
      });
      continue;
    }

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
  const pattern = /(!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > cursor) {
      tokens.push({ type: "text", text: input.slice(cursor, match.index) });
    }
    if (match[2] !== undefined && match[3]) {
      tokens.push({ type: "image", alt: match[2], src: match[3] });
    } else if (match[4]) {
      tokens.push({ type: "strong", text: match[4] });
    } else if (match[5]) {
      tokens.push({ type: "code", text: match[5] });
    } else if (match[6]) {
      tokens.push({ type: "em", text: match[6] });
    }
    cursor = match.index + match[0].length;
  }

  if (cursor < input.length) {
    tokens.push({ type: "text", text: input.slice(cursor) });
  }

  return tokens;
}
