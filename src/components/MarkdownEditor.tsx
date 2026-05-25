interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  return (
    <textarea
      className="markdown-editor"
      value={value}
      spellCheck={false}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Markdown editor"
    />
  );
}
