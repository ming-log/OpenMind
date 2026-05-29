export const THEME_IDS = [
  "sage-mint",
  "warm-ember",
  "violet-orchid",
  "ink-blue",
  "aqua-dots",
  "sunrise-split",
  "mono-graphite",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];
export type CanvasPattern = "grid" | "dots" | "plain";

export interface ThemeExportNodePalette {
  bg: string;
  border: string;
  text: string;
}

export interface BranchPalette {
  node: ThemeExportNodePalette;
  edge: string;
}

export interface ThemeExportPalette {
  canvas: string;
  grid: string;
  pattern: CanvasPattern;
  text: string;
  edge: string;
  edgeLeft: string;
  edgeRight: string;
  root: ThemeExportNodePalette;
  node: ThemeExportNodePalette;
  nodeLeft: ThemeExportNodePalette;
  nodeRight: ThemeExportNodePalette;
  branches: readonly BranchPalette[];
}

export interface ThemePreset {
  id: ThemeId;
  name: string;
  swatches: readonly string[];
  cssVars: Record<string, string>;
  branches: readonly BranchPalette[];
  exportPalette: ThemeExportPalette;
}

interface ThemeInput {
  id: ThemeId;
  name: string;
  swatches: readonly string[];
  canvas: string;
  grid: string;
  pattern: CanvasPattern;
  surface: string;
  surfaceSoft: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textSoft: string;
  muted: string;
  mutedLight: string;
  accent: string;
  accentBright: string;
  accentStrong: string;
  accentSoft: string;
  accentTint: string;
  accentRing: string;
  chromeBg: string;
  chromeBgSoft: string;
  edge: string;
  edgeLeft?: string;
  edgeRight?: string;
  root: ThemeExportNodePalette;
  node: ThemeExportNodePalette;
  nodeLeft?: ThemeExportNodePalette;
  nodeRight?: ThemeExportNodePalette;
  branches?: readonly BranchPalette[];
}

export const DEFAULT_THEME_ID: ThemeId = "sage-mint";

function createCanvasPattern(canvas: string, grid: string, pattern: CanvasPattern): string {
  if (pattern === "dots") {
    return `radial-gradient(circle, ${grid} 1px, transparent 1.2px), ${canvas}`;
  }
  if (pattern === "plain") {
    return canvas;
  }
  return `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px), ${canvas}`;
}

function createCanvasGridSize(pattern: CanvasPattern): string {
  return pattern === "dots" ? "18px 18px" : "32px 32px";
}

function createTheme(input: ThemeInput): ThemePreset {
  const edgeLeft = input.edgeLeft ?? input.edge;
  const edgeRight = input.edgeRight ?? input.edge;
  const nodeLeft = input.nodeLeft ?? input.node;
  const nodeRight = input.nodeRight ?? input.node;
  const branches = input.branches ?? [{ node: input.node, edge: input.edge }];

  return {
    id: input.id,
    name: input.name,
    swatches: input.swatches,
    branches,
    cssVars: {
      "--canvas": input.canvas,
      "--canvas-grid": input.grid,
      "--canvas-pattern": createCanvasPattern(input.canvas, input.grid, input.pattern),
      "--canvas-grid-size": createCanvasGridSize(input.pattern),
      "--surface": input.surface,
      "--surface-soft": input.surfaceSoft,
      "--surface-muted": input.surfaceMuted,
      "--border": input.border,
      "--border-strong": input.borderStrong,
      "--text": input.text,
      "--text-soft": input.textSoft,
      "--muted": input.muted,
      "--muted-light": input.mutedLight,
      "--accent": input.accent,
      "--accent-bright": input.accentBright,
      "--accent-strong": input.accentStrong,
      "--accent-soft": input.accentSoft,
      "--accent-tint": input.accentTint,
      "--accent-ring": input.accentRing,
      "--chrome-bg": input.chromeBg,
      "--chrome-bg-soft": input.chromeBgSoft,
      "--edge": input.edge,
      "--edge-left": edgeLeft,
      "--edge-right": edgeRight,
      "--root-bg": input.root.bg,
      "--root-border": input.root.border,
      "--root-text": input.root.text,
      "--node-bg": input.node.bg,
      "--node-border": input.node.border,
      "--node-text": input.node.text,
      "--node-left-bg": nodeLeft.bg,
      "--node-left-border": nodeLeft.border,
      "--node-left-text": nodeLeft.text,
      "--node-right-bg": nodeRight.bg,
      "--node-right-border": nodeRight.border,
      "--node-right-text": nodeRight.text,
      "--node-selection-gap": input.surface,
    },
    exportPalette: {
      canvas: input.canvas,
      grid: input.grid,
      pattern: input.pattern,
      text: input.textSoft,
      edge: input.edge,
      edgeLeft,
      edgeRight,
      root: input.root,
      node: input.node,
      nodeLeft,
      nodeRight,
      branches,
    },
  };
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  createTheme({
    id: "sage-mint",
    name: "青瓷绿",
    swatches: ["#e8ece8", "#163b3b", "#9dd4c1", "#5fa9a6"],
    canvas: "#e8ece8",
    grid: "rgba(95, 122, 112, 0.13)",
    pattern: "plain",
    surface: "#f8fbf7",
    surfaceSoft: "#eef5ef",
    surfaceMuted: "#dfe9e2",
    border: "#c7d6ce",
    borderStrong: "#94b1a4",
    text: "#152623",
    textSoft: "#314b45",
    muted: "#647a73",
    mutedLight: "#8ca099",
    accent: "#297f78",
    accentBright: "#49a394",
    accentStrong: "#163b3b",
    accentSoft: "#d9efe7",
    accentTint: "rgba(73, 163, 148, 0.16)",
    accentRing: "rgba(41, 127, 120, 0.24)",
    chromeBg: "rgba(248, 251, 247, 0.96)",
    chromeBgSoft: "rgba(248, 251, 247, 0.84)",
    edge: "#6aa9a7",
    root: { bg: "#163b3b", border: "#163b3b", text: "#f7fffb" },
    node: { bg: "#9dd4c1", border: "#72b79f", text: "#18352f" },
    branches: [
      { node: { bg: "#2f5d5c", border: "#214746", text: "#eafff8" }, edge: "#1f4a49" },
      { node: { bg: "#9dd4c1", border: "#72b79f", text: "#18352f" }, edge: "#6aa9a7" },
      { node: { bg: "#6cc0b4", border: "#48a99b", text: "#10302c" }, edge: "#49a394" },
    ],
  }),
  createTheme({
    id: "warm-ember",
    name: "暖陶红",
    swatches: ["#fbf7ef", "#4b302f", "#b95a48", "#7da0bf"],
    canvas: "#fbf7ef",
    grid: "rgba(150, 122, 94, 0.13)",
    pattern: "plain",
    surface: "#fffaf2",
    surfaceSoft: "#f6efe5",
    surfaceMuted: "#efe1d0",
    border: "#decbbb",
    borderStrong: "#bd9e8f",
    text: "#332421",
    textSoft: "#5a433b",
    muted: "#8a7065",
    mutedLight: "#a99388",
    accent: "#a9493c",
    accentBright: "#c96550",
    accentStrong: "#4b302f",
    accentSoft: "#f6ded6",
    accentTint: "rgba(185, 90, 72, 0.14)",
    accentRing: "rgba(169, 73, 60, 0.24)",
    chromeBg: "rgba(255, 250, 242, 0.96)",
    chromeBgSoft: "rgba(255, 250, 242, 0.84)",
    edge: "#8aa3bc",
    edgeLeft: "#7da0bf",
    edgeRight: "#be6a58",
    root: { bg: "#4b302f", border: "#4b302f", text: "#fff8f0" },
    node: { bg: "#b95a48", border: "#9d4639", text: "#fff9f3" },
    nodeLeft: { bg: "#dbe7ee", border: "#8fb0c9", text: "#27475a" },
    nodeRight: { bg: "#b95a48", border: "#9d4639", text: "#fff9f3" },
    branches: [
      { node: { bg: "#aebfd0", border: "#8fb0c9", text: "#23384a" }, edge: "#7da0bf" },
      { node: { bg: "#b95a48", border: "#9d4639", text: "#fff9f3" }, edge: "#be6a58" },
      { node: { bg: "#aebfd0", border: "#8fb0c9", text: "#23384a" }, edge: "#7da0bf" },
    ],
  }),
  createTheme({
    id: "violet-orchid",
    name: "藤紫",
    swatches: ["#f0eef3", "#68429a", "#8752b5", "#b190cf"],
    canvas: "#f0eef3",
    grid: "rgba(116, 82, 154, 0.12)",
    pattern: "plain",
    surface: "#fbf9ff",
    surfaceSoft: "#f1ebf8",
    surfaceMuted: "#e8def2",
    border: "#d9cbe6",
    borderStrong: "#bfa7d5",
    text: "#2a2430",
    textSoft: "#4b3d56",
    muted: "#766887",
    mutedLight: "#9c8fad",
    accent: "#7048a4",
    accentBright: "#8d5dc0",
    accentStrong: "#553078",
    accentSoft: "#ece2f7",
    accentTint: "rgba(141, 93, 192, 0.14)",
    accentRing: "rgba(112, 72, 164, 0.24)",
    chromeBg: "rgba(251, 249, 255, 0.96)",
    chromeBgSoft: "rgba(251, 249, 255, 0.84)",
    edge: "#9b78bd",
    root: { bg: "#68429a", border: "#68429a", text: "#fffaff" },
    node: { bg: "#8658b6", border: "#6f469e", text: "#fffaff" },
  }),
  createTheme({
    id: "ink-blue",
    name: "墨蓝",
    swatches: ["#eef9f8", "#12344b", "#294f6f", "#7caac3"],
    canvas: "#eef9f8",
    grid: "rgba(51, 88, 110, 0.12)",
    pattern: "plain",
    surface: "#f8fdfc",
    surfaceSoft: "#eaf4f4",
    surfaceMuted: "#dbe9ea",
    border: "#cadadc",
    borderStrong: "#9db6bf",
    text: "#142634",
    textSoft: "#334d5c",
    muted: "#66808b",
    mutedLight: "#8fa5ad",
    accent: "#24506f",
    accentBright: "#386b8d",
    accentStrong: "#12344b",
    accentSoft: "#dcecf3",
    accentTint: "rgba(56, 107, 141, 0.14)",
    accentRing: "rgba(36, 80, 111, 0.24)",
    chromeBg: "rgba(248, 253, 252, 0.96)",
    chromeBgSoft: "rgba(248, 253, 252, 0.84)",
    edge: "#263f50",
    root: { bg: "#12344b", border: "#12344b", text: "#f6fbff" },
    node: { bg: "#294f6f", border: "#1d405b", text: "#f6fbff" },
  }),
  createTheme({
    id: "aqua-dots",
    name: "圆点青",
    swatches: ["#fcfff9", "#267b78", "#8de1d5", "#e2eadf"],
    canvas: "#fcfff9",
    grid: "rgba(202, 215, 202, 0.7)",
    pattern: "dots",
    surface: "#ffffff",
    surfaceSoft: "#eefaf6",
    surfaceMuted: "#dcf2eb",
    border: "#c7ddd5",
    borderStrong: "#8cc5b8",
    text: "#172925",
    textSoft: "#36534d",
    muted: "#6a827b",
    mutedLight: "#92a8a1",
    accent: "#267b78",
    accentBright: "#43b8ac",
    accentStrong: "#1d5f5c",
    accentSoft: "#dff6f0",
    accentTint: "rgba(67, 184, 172, 0.14)",
    accentRing: "rgba(38, 123, 120, 0.24)",
    chromeBg: "rgba(255, 255, 255, 0.94)",
    chromeBgSoft: "rgba(255, 255, 255, 0.82)",
    edge: "#62c8c4",
    root: { bg: "#267b78", border: "#267b78", text: "#f5fffd" },
    node: { bg: "#8de1d5", border: "#4fc1b5", text: "#173b37" },
  }),
  createTheme({
    id: "sunrise-split",
    name: "朝霞分支",
    swatches: ["#eff0fb", "#2d2b8f", "#f28f34", "#86aaf2"],
    canvas: "#eff0fb",
    grid: "rgba(94, 103, 165, 0.12)",
    pattern: "plain",
    surface: "#fbfbff",
    surfaceSoft: "#eeeffa",
    surfaceMuted: "#e4e6f5",
    border: "#d4d7eb",
    borderStrong: "#aab0d7",
    text: "#24243b",
    textSoft: "#484963",
    muted: "#737590",
    mutedLight: "#9a9db6",
    accent: "#2d2b8f",
    accentBright: "#466dde",
    accentStrong: "#23216f",
    accentSoft: "#e3e5ff",
    accentTint: "rgba(70, 109, 222, 0.13)",
    accentRing: "rgba(45, 43, 143, 0.24)",
    chromeBg: "rgba(251, 251, 255, 0.96)",
    chromeBgSoft: "rgba(251, 251, 255, 0.84)",
    edge: "#a7aee8",
    edgeLeft: "#789fec",
    edgeRight: "#e99178",
    root: { bg: "#2d2b8f", border: "#2d2b8f", text: "#ffffff" },
    node: { bg: "#f28f34", border: "#da7830", text: "#351d0d" },
    nodeLeft: { bg: "#86aaf2", border: "#668ee0", text: "#132b5c" },
    nodeRight: { bg: "#f28f34", border: "#da7830", text: "#351d0d" },
    branches: [
      { node: { bg: "#9fbdf6", border: "#7ba0e8", text: "#16306a" }, edge: "#789fec" },
      { node: { bg: "#f28f34", border: "#da7830", text: "#351d0d" }, edge: "#ef8a4e" },
      { node: { bg: "#f3b4ad", border: "#e79a92", text: "#5a2a25" }, edge: "#ef9f95" },
    ],
  }),
  createTheme({
    id: "mono-graphite",
    name: "石墨灰",
    swatches: ["#f7f7f6", "#111111", "#8d8d8d", "#c9c9c9"],
    canvas: "#f7f7f6",
    grid: "rgba(132, 132, 132, 0.12)",
    pattern: "plain",
    surface: "#ffffff",
    surfaceSoft: "#f0f0ef",
    surfaceMuted: "#e5e5e3",
    border: "#d4d4d1",
    borderStrong: "#a5a5a1",
    text: "#161616",
    textSoft: "#3b3b3b",
    muted: "#70706d",
    mutedLight: "#9a9a96",
    accent: "#111111",
    accentBright: "#555555",
    accentStrong: "#000000",
    accentSoft: "#e9e9e7",
    accentTint: "rgba(17, 17, 17, 0.08)",
    accentRing: "rgba(17, 17, 17, 0.22)",
    chromeBg: "rgba(255, 255, 255, 0.96)",
    chromeBgSoft: "rgba(255, 255, 255, 0.84)",
    edge: "#9a9a96",
    root: { bg: "#111111", border: "#111111", text: "#ffffff" },
    node: { bg: "#8d8d8d", border: "#737373", text: "#ffffff" },
  }),
];

export function getThemePreset(themeId?: string): ThemePreset {
  return THEME_PRESETS.find((theme) => theme.id === themeId) ?? THEME_PRESETS[0];
}
