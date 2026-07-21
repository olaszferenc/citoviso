// Skin = "skin as data": a set of --cit-* design tokens (06-UI-CONTRACT). The
// primitives' CSS dresses ONLY from these tokens, so one primitive renders natively
// in any skin. A skin never changes STRUCTURE — only look. This is the variety axis:
// the same recipe + data in a different skin is a different-looking, same-structured
// page. Combined with primitive/palette/module combinatorics → hundreds of dimensions.

export interface Skin {
  readonly id: string;
  readonly label: string;
  readonly tokens: Readonly<Record<string, string>>;
}

export const SKINS: Readonly<Record<string, Skin>> = {
  "editorial-warm": {
    id: "editorial-warm",
    label: "Editorial — meleg, világos",
    tokens: {
      "--cit-accent": "#7c2d3a",
      "--cit-on-accent": "#ffffff",
      "--cit-ink": "#211d1a",
      "--cit-muted": "#6b625b",
      "--cit-bg": "#faf6f0",
      "--cit-surface": "#ffffff",
      "--cit-line": "#e7ded3",
      "--cit-radius": "14px",
      "--cit-font-display": "'Georgia', 'Times New Roman', serif",
      "--cit-font-body": "system-ui, -apple-system, sans-serif",
      "--cit-shadow": "0 6px 24px rgba(33,29,26,.08)",
    },
  },
  "immersive-dark": {
    id: "immersive-dark",
    label: "Immersive — sötét, elegáns",
    tokens: {
      "--cit-accent": "#c9a86a",
      "--cit-on-accent": "#1a1712",
      "--cit-ink": "#f2ece1",
      "--cit-muted": "#a99f8d",
      "--cit-bg": "#14110d",
      "--cit-surface": "#1e1a15",
      "--cit-line": "#332c22",
      "--cit-radius": "10px",
      "--cit-font-display": "'Georgia', 'Times New Roman', serif",
      "--cit-font-body": "system-ui, -apple-system, sans-serif",
      "--cit-shadow": "0 10px 40px rgba(0,0,0,.5)",
    },
  },
};

/** Render a skin's tokens as a `:root { ... }` block. */
export function renderSkinVars(skin: Skin): string {
  const body = Object.entries(skin.tokens)
    .map(([k, v]) => `    ${k}: ${v};`)
    .join("\n");
  return `:root {\n${body}\n  }`;
}
