/**
 * Les elements que l'editeur dessine a la place du markdown brut.
 *
 * Chaque widget remplace un morceau de texte source : une case a cocher au lieu
 * de `- [ ]`, un trait au lieu de `---`, un vrai tableau au lieu de ses barres
 * verticales. Le fichier sur le disque, lui, reste du markdown ordinaire.
 */

import { EditorView, WidgetType } from "@codemirror/view";
import { api } from "../lib/api";

/** Une case a cocher, cliquable, a la place de `[ ]` ou `[x]`. */
export class CheckboxWidget extends WidgetType {
  constructor(
    private readonly checked: boolean,
    private readonly pos: number,
  ) {
    super();
  }

  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.pos === this.pos;
  }

  toDOM(view: EditorView) {
    const box = document.createElement("span");
    box.className = `cm-task${this.checked ? " is-checked" : ""}`;
    box.setAttribute("role", "checkbox");
    box.setAttribute("aria-checked", String(this.checked));
    box.onmousedown = (event) => {
      event.preventDefault();
      // On reecrit la seule lettre entre crochets : le reste de la ligne ne bouge pas.
      view.dispatch({
        changes: { from: this.pos + 1, to: this.pos + 2, insert: this.checked ? " " : "x" },
      });
    };
    return box;
  }

  ignoreEvent() {
    return false;
  }
}

/** Le trait de separation dessine a la place de `---`. */
export class RuleWidget extends WidgetType {
  eq() {
    return true;
  }

  toDOM() {
    const rule = document.createElement("span");
    rule.className = "cm-rule";
    return rule;
  }
}

/** Une image du Vault, retrouvee par son nom quel que soit son sous-dossier. */
export class ImageWidget extends WidgetType {
  constructor(
    private readonly source: string,
    private readonly alt: string,
  ) {
    super();
  }

  eq(other: ImageWidget) {
    return other.source === this.source && other.alt === this.alt;
  }

  toDOM() {
    const frame = document.createElement("span");
    frame.className = "cm-image";

    const image = document.createElement("img");
    image.alt = this.alt;
    image.draggable = false;
    image.src = /^(https?:|data:)/.test(this.source)
      ? this.source
      : api.assetUrl(this.source);
    image.onerror = () => {
      frame.classList.add("is-missing");
      frame.textContent = `Image introuvable : ${this.source}`;
    };

    frame.appendChild(image);
    if (this.alt) {
      const caption = document.createElement("span");
      caption.className = "cm-image__caption";
      caption.textContent = this.alt;
      frame.appendChild(caption);
    }
    return frame;
  }
}

/** Un vrai tableau, dessine a la place de ses barres verticales. */
export class TableWidget extends WidgetType {
  constructor(private readonly source: string) {
    super();
  }

  eq(other: TableWidget) {
    return other.source === this.source;
  }

  toDOM() {
    const frame = document.createElement("div");
    frame.className = "cm-table";
    const table = document.createElement("table");

    const rows = this.source
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    rows.forEach((line, index) => {
      // La deuxieme ligne (`|---|---|`) ne fait que separer l'entete du corps.
      if (index === 1 && /^\|?[\s:|-]+\|?$/.test(line)) return;
      const row = document.createElement("tr");
      for (const cell of splitRow(line)) {
        const box = document.createElement(index === 0 ? "th" : "td");
        box.textContent = cell;
        row.appendChild(box);
      }
      table.appendChild(row);
    });

    frame.appendChild(table);
    return frame;
  }
}

/** Une formule mathematique, composee par KaTeX. */
export class MathWidget extends WidgetType {
  constructor(
    private readonly formula: string,
    private readonly block: boolean,
  ) {
    super();
  }

  eq(other: MathWidget) {
    return other.formula === this.formula && other.block === this.block;
  }

  toDOM() {
    const frame = document.createElement(this.block ? "div" : "span");
    frame.className = this.block ? "cm-math cm-math--block" : "cm-math";
    // KaTeX pese plusieurs centaines de kilo-octets : il n'est charge que si
    // une note contient reellement une formule.
    void import("katex")
      .then(({ default: katex }) => {
        katex.render(this.formula, frame, {
          displayMode: this.block,
          throwOnError: false,
          output: "html",
        });
      })
      .catch(() => {
        frame.classList.add("is-missing");
        frame.textContent = this.formula;
      });
    return frame;
  }
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}
