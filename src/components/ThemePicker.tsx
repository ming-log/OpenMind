import { useState } from "react";
import type { ThemeId, ThemePreset } from "../domain/themes";
import { PaletteIcon } from "./Icons";

interface ThemePickerProps {
  themeId: ThemeId;
  themes: readonly ThemePreset[];
  onThemeChange: (themeId: ThemeId) => void;
}

export function ThemePicker({ themeId, themes, onThemeChange }: ThemePickerProps) {
  const activeTheme = themes.find((theme) => theme.id === themeId) ?? themes[0];
  const [open, setOpen] = useState(false);

  return (
    <aside className={`theme-dock ${open ? "open" : ""}`} aria-label="主题">
      <button
        aria-expanded={open}
        aria-label={open ? "收起主题选择" : "展开主题选择"}
        className="theme-dock-toggle"
        onClick={() => setOpen((current) => !current)}
        title={activeTheme ? `主题：${activeTheme.name}` : "主题"}
        type="button"
      >
        <PaletteIcon />
      </button>
      {open ? (
        <div className="theme-dock-panel">
          <span className="theme-dock-label">主题</span>
          <div className="theme-swatch-grid" role="radiogroup" aria-label="主题">
            {themes.map((theme) => (
              <button
                aria-checked={theme.id === themeId}
                aria-label={`切换主题：${theme.name}`}
                className={`theme-swatch-button ${theme.id === themeId ? "active" : ""}`}
                key={theme.id}
                onClick={() => onThemeChange(theme.id)}
                role="radio"
                title={theme.name}
                type="button"
              >
                <span className="theme-swatch-stack" aria-hidden="true">
                  {theme.swatches.map((swatch) => (
                    <span key={swatch} style={{ background: swatch }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
          <span className="theme-dock-current">{activeTheme?.name}</span>
        </div>
      ) : null}
    </aside>
  );
}
