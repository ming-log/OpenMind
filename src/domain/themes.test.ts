import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_ID, getThemePreset, THEME_PRESETS } from "./themes";

describe("theme presets", () => {
  it("defines one selectable preset for each provided theme reference", () => {
    expect(THEME_PRESETS).toHaveLength(7);
    expect(new Set(THEME_PRESETS.map((theme) => theme.id)).size).toBe(7);
  });

  it("falls back to the default theme for unknown persisted values", () => {
    expect(getThemePreset().id).toBe(DEFAULT_THEME_ID);
    expect(getThemePreset("missing").id).toBe(DEFAULT_THEME_ID);
  });

  it("provides CSS variables and export colors for every theme", () => {
    for (const theme of THEME_PRESETS) {
      expect(theme.cssVars["--canvas"]).toBeTruthy();
      expect(theme.cssVars["--root-bg"]).toBeTruthy();
      expect(theme.cssVars["--node-left-bg"]).toBeTruthy();
      expect(theme.cssVars["--node-right-bg"]).toBeTruthy();
      expect(theme.cssVars["--edge-left"]).toBeTruthy();
      expect(theme.exportPalette.text).toBeTruthy();
      expect(theme.exportPalette.root.bg).toBe(theme.cssVars["--root-bg"]);
      expect(theme.exportPalette.nodeLeft.bg).toBe(theme.cssVars["--node-left-bg"]);
      expect(theme.exportPalette.nodeRight.bg).toBe(theme.cssVars["--node-right-bg"]);
    }
  });
});
