export type ThemeName = "dark" | "light";

export const darkTokens = {
  bg: "#0f1419",
  headerBg: "#161b22",
  statusBg: "#0c1015",
  fg: "#e4ecf5",
  fgMuted: "#9aa6b8",
  fgFaint: "#5f6b7c",
  divider: "rgba(255,255,255,0.06)",
  windowBorder: "rgba(255,255,255,0.08)",
  cardBg: "rgba(255,255,255,0.03)",
  cardBorder: "rgba(255,255,255,0.06)",
  accent: "#7aa2f7",
  overlayBg: "rgba(20, 25, 33, 0.92)",
  overlayBorder: "rgba(255,255,255,0.08)",
  rec: "#f7768e",
  done: "#7dd3a0",
} as const;

export const lightTokens = {
  bg: "#fafbfc",
  headerBg: "#f1f3f6",
  statusBg: "#eef1f5",
  fg: "#1a2330",
  fgMuted: "#5a6678",
  fgFaint: "#8b96a8",
  divider: "rgba(15,20,25,0.07)",
  windowBorder: "rgba(15,20,25,0.1)",
  cardBg: "#ffffff",
  cardBorder: "rgba(15,20,25,0.07)",
  accent: "#3b6fd6",
  overlayBg: "rgba(255, 255, 255, 0.94)",
  overlayBorder: "rgba(15,20,25,0.1)",
  rec: "#d33b5e",
  done: "#2d8f5a",
} as const;

export type Tokens = typeof darkTokens;

export function applyTheme(name: ThemeName): void {
  const t = name === "dark" ? darkTokens : lightTokens;
  const root = document.documentElement;
  root.dataset.theme = name;
  for (const [k, v] of Object.entries(t)) {
    root.style.setProperty(`--${k}`, v as string);
  }
}

export function detectSystemTheme(): ThemeName {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
