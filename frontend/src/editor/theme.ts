/**
 * Theme de l'editeur : uniquement ce que CodeMirror doit savoir.
 *
 * Tout l'aspect du markdown mis en forme (titres, puces, cases a cocher,
 * tableaux, formules) vit dans `styles/editor.css`, pour rester modifiable
 * sans toucher au code.
 */

import { EditorView } from "@codemirror/view";

export const mentaliisTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      color: "var(--text)",
      backgroundColor: "transparent",
    },
    ".cm-content": {
      fontFamily: "var(--font-body)",
      lineHeight: "1.75",
      caretColor: "var(--accent)",
    },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "var(--font-body)",
      // A droite seulement : a gauche, c'est la gouttiere d'ecriture qui place
      // la colonne, et un remplissage supplementaire la decalerait du titre.
      padding: "0 28px 0 0",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--accent)",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "var(--selection)",
    },
    ".cm-activeLine": { backgroundColor: "rgba(255, 255, 255, 0.022)" },
    ".cm-placeholder": { color: "var(--text-faint)" },
    ".cm-gutters": { display: "none" },
  },
  { dark: true },
);
