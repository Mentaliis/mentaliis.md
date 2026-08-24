/** Theme sombre de l'editeur, accorde a l'environnement. */

import { EditorView } from "@codemirror/view";

export const mentaliisTheme = EditorView.theme(
  {
    "&": {
      color: "var(--text)",
      backgroundColor: "transparent",
      height: "100%",
      fontSize: "15px",
    },
    ".cm-content": {
      caretColor: "var(--accent)",
      fontFamily: "var(--font-body)",
      lineHeight: "1.7",
      padding: "8px 0 40vh",
      maxWidth: "72ch",
    },
    ".cm-scroller": { overflow: "auto", fontFamily: "var(--font-body)" },
    "&.cm-focused": { outline: "none" },
    ".cm-line": { padding: "0 2px" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "var(--selection)",
    },
    ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.02)" },
    ".cm-gutters": { display: "none" },
  },
  { dark: true },
);
