import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { parseNoteMarkdown, type InlineToken, type NoteBlock } from "../domain/noteMarkdown";
import { XIcon } from "./Icons";

interface NoteBubbleProps {
  note: string;
  pinned?: boolean;
}

export function NoteBubble({ note, pinned = false }: NoteBubbleProps) {
  return (
    <div
      className={`note-bubble ${pinned ? "pinned" : "hover"}`}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <NoteMarkdownContent note={note} />
    </div>
  );
}

export function NoteMarkdownContent({ note }: { note: string }) {
  const blocks = useMemo(() => parseNoteMarkdown(note), [note]);
  const galleryImages = useMemo(() => collectImages(blocks), [blocks]);
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const zoomImage = zoomIndex !== null ? galleryImages[zoomIndex] : undefined;

  useEffect(() => {
    if (zoomIndex === null) return;
    if (galleryImages.length === 0) {
      setZoomIndex(null);
      return;
    }
    if (zoomIndex >= galleryImages.length) {
      setZoomIndex(galleryImages.length - 1);
    }
  }, [galleryImages.length, zoomIndex]);

  useEffect(() => {
    if (zoomIndex === null) return undefined;

    function keydown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setZoomIndex(null);
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        setZoomIndex((current) => {
          if (current === null || galleryImages.length <= 1) return current;
          return (current + 1) % galleryImages.length;
        });
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setZoomIndex((current) => {
          if (current === null || galleryImages.length <= 1) return current;
          return (current - 1 + galleryImages.length) % galleryImages.length;
        });
      }
    }

    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [galleryImages.length, zoomIndex]);

  const renderContext: RenderInlineContext = {
    imageIndex: 0,
    onZoomImage: setZoomIndex,
  };

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
                <li key={itemIndex}>{renderInline(item, renderContext)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "table") {
          return (
            <div className="note-table-wrap" key={index}>
              <table className="note-table">
                <thead>
                  <tr>
                    {block.header.map((cell, cellIndex) => (
                      <th key={cellIndex}>{renderInline(cell, renderContext)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex}>{renderInline(cell, renderContext)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type === "blockquote") {
          return <blockquote key={index}>{renderInline(block.children, renderContext)}</blockquote>;
        }
        return <p key={index}>{renderInline(block.children, renderContext)}</p>;
      })}
      {zoomImage && typeof document !== "undefined" ? createPortal((
        <div
          aria-modal="true"
          className="image-preview-backdrop"
          onClick={(event) => {
            event.stopPropagation();
            setZoomIndex(null);
          }}
          onMouseDown={(event) => event.stopPropagation()}
          role="dialog"
        >
          <figure
            className={`image-preview ${galleryImages.length > 1 ? "with-thumbs" : ""}`}
            onClick={(event) => event.stopPropagation()}
          >
            <button className="image-preview-close" aria-label="关闭图片预览" onClick={() => setZoomIndex(null)} type="button"><XIcon /></button>
            {galleryImages.length > 1 ? (
              <aside className="image-preview-thumbs" aria-label="图片缩略图">
                {galleryImages.map((image, index) => (
                  <button
                    aria-label={`查看图片 ${index + 1}`}
                    className={`image-preview-thumb ${index === zoomIndex ? "active" : ""}`}
                    key={`${image.src}-${index}`}
                    onClick={() => setZoomIndex(index)}
                    type="button"
                  >
                    <img alt={image.alt || `图片 ${index + 1}`} src={image.src} />
                  </button>
                ))}
              </aside>
            ) : null}
            <div className="image-preview-main">
              <img alt={zoomImage.alt} src={zoomImage.src} />
              <figcaption>
                {zoomImage.alt ? <span>{zoomImage.alt}</span> : null}
                {galleryImages.length > 1 ? <small>{(zoomIndex ?? 0) + 1} / {galleryImages.length}</small> : null}
              </figcaption>
            </div>
          </figure>
        </div>
      ), document.body) : null}
    </>
  );
}

interface NoteImage {
  alt: string;
  src: string;
}

interface RenderInlineContext {
  imageIndex: number;
  onZoomImage: (index: number) => void;
}

function collectImages(blocks: NoteBlock[]): NoteImage[] {
  const images: NoteImage[] = [];

  function collectInline(tokens: InlineToken[]): void {
    tokens.forEach((token) => {
      if (token.type === "image") {
        images.push({ alt: token.alt, src: token.src });
      }
    });
  }

  blocks.forEach((block) => {
    if (block.type === "paragraph" || block.type === "blockquote") {
      collectInline(block.children);
    }
    if (block.type === "list") {
      block.items.forEach(collectInline);
    }
    if (block.type === "table") {
      block.header.forEach(collectInline);
      block.rows.forEach((row) => row.forEach(collectInline));
    }
  });

  return images;
}

function renderInline(tokens: InlineToken[], context: RenderInlineContext) {
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
    if (token.type === "link") {
      return (
        <a href={token.href} key={index} rel="noreferrer" target="_blank">
          {token.text}
        </a>
      );
    }
    if (token.type === "image") {
      const imageIndex = context.imageIndex;
      context.imageIndex += 1;
      return (
        <button
          className="note-image-button"
          key={index}
          onClick={(event) => {
            event.stopPropagation();
            context.onZoomImage(imageIndex);
          }}
          onMouseDown={(event) => event.stopPropagation()}
          title="放大图片"
          type="button"
        >
          <img alt={token.alt} className="note-image" src={token.src} />
        </button>
      );
    }
    return token.text;
  });
}
