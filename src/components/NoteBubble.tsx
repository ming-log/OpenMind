import { parseNoteMarkdown, type InlineToken } from "../domain/noteMarkdown";

interface NoteBubbleProps {
  note: string;
  pinned?: boolean;
}

export function NoteBubble({ note, pinned = false }: NoteBubbleProps) {
  return (
    <div className={`note-bubble ${pinned ? "pinned" : "hover"}`}>
      <NoteMarkdownContent note={note} />
    </div>
  );
}

export function NoteMarkdownContent({ note }: { note: string }) {
  const blocks = parseNoteMarkdown(note);

  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === "codeBlock") {
          return (
            <pre className="note-code-block" key={index}>
              <code>{block.code}</code>
            </pre>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{renderInline(block.children)}</p>;
      })}
    </>
  );
}

function renderInline(tokens: InlineToken[]) {
  return tokens.map((token, index) => {
    if (token.type === "strong") {
      return <strong key={index}>{token.text}</strong>;
    }
    if (token.type === "em") {
      return <em key={index}>{token.text}</em>;
    }
    if (token.type === "code") {
      return <code key={index}>{token.text}</code>;
    }
    if (token.type === "image") {
      return <img alt={token.alt} className="note-image" key={index} src={token.src} />;
    }
    return token.text;
  });
}
