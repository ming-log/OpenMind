import { parseNoteMarkdown, type InlineToken } from "../domain/noteMarkdown";

interface NoteBubbleProps {
  note: string;
  pinned?: boolean;
}

export function NoteBubble({ note, pinned = false }: NoteBubbleProps) {
  const blocks = parseNoteMarkdown(note);

  return (
    <div className={`note-bubble ${pinned ? "pinned" : "hover"}`}>
      {blocks.map((block, index) => {
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
    </div>
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
    return token.text;
  });
}
