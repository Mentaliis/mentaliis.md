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

/** Familles reconnues, deduites de l'extension du fichier. */
const VIDEOS = /\.(mp4|webm|ogv|mov|mkv)$/i;
const AUDIOS = /\.(mp3|wav|ogg|m4a|flac|opus)$/i;
const IMAGES = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;

/**
 * Un media embarque par `![[nom]]` : image, video, son ou fichier.
 *
 * On ne voit jamais la syntaxe — seulement le media, joue ou telechargeable.
 */
export class EmbedWidget extends WidgetType {
  constructor(private readonly source: string) {
    super();
  }

  eq(other: EmbedWidget) {
    return other.source === this.source;
  }

  toDOM() {
    const url = /^(https?:|data:)/.test(this.source)
      ? this.source
      : api.assetUrl(this.source);
    const nom = this.source.split("/").pop() ?? this.source;

    if (VIDEOS.test(this.source)) return media("video", url, nom);
    if (AUDIOS.test(this.source)) return media("audio", url, nom);
    if (IMAGES.test(this.source)) return new ImageWidget(this.source, "").toDOM();
    return fileCard(url, nom);
  }
}

/** Une video ou un son, avec les commandes du systeme. */
function media(kind: "video" | "audio", url: string, nom: string): HTMLElement {
  const frame = document.createElement("span");
  frame.className = `cm-embed cm-embed--${kind}`;
  const element = document.createElement(kind);
  element.controls = true;
  element.preload = "metadata";
  element.src = url;
  element.onerror = () => {
    frame.classList.add("is-missing");
    frame.textContent = `Introuvable : ${nom}`;
  };
  frame.appendChild(element);
  return frame;
}

/** Un fichier quelconque : une carte qu'on peut ouvrir. */
function fileCard(url: string, nom: string): HTMLElement {
  const frame = document.createElement("span");
  frame.className = "cm-embed cm-embed--fichier";
  const lien = document.createElement("a");
  lien.href = url;
  lien.target = "_blank";
  lien.rel = "noreferrer";
  lien.className = "cm-file";
  lien.innerHTML =
    '<span class="cm-file__icon" aria-hidden="true">' +
    '<svg viewBox="0 0 16 16"><path d="M4 1.5h5L13 5.5V14a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 3 14V2a.5.5 0 0 1 .5-.5Z"' +
    ' fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M9 1.5V5.5H13"' +
    ' fill="none" stroke="currentColor" stroke-width="1.3"/></svg></span>';
  const nomElement = document.createElement("span");
  nomElement.className = "cm-file__name";
  nomElement.textContent = nom;
  lien.appendChild(nomElement);
  frame.appendChild(lien);
  return frame;
}

/**
 * Un vrai tableau, modifiable sur place.
 *
 * On ne voit jamais ses barres verticales : on ecrit dans les cases, et le
 * markdown est reecrit dessous. Deux poignees permettent d'ajouter une ligne ou
 * une colonne, comme dans n'importe quel tableur.
 */
export class TableWidget extends WidgetType {
  constructor(
    private readonly source: string,
    private readonly from: number,
    private readonly to: number,
  ) {
    super();
  }

  eq(other: TableWidget) {
    return other.source === this.source && other.from === this.from;
  }

  /** Le tableau garde le focus : CodeMirror ne doit pas le lui reprendre. */
  ignoreEvent() {
    return true;
  }

  toDOM(view: EditorView) {
    const grille = parseTable(this.source);
    const frame = document.createElement("div");
    frame.className = "cm-table";

    /** Reecrit le markdown sous le tableau, sans jamais le montrer. */
    const ecrire = (prochaine: string[][]) => {
      view.dispatch({
        changes: { from: this.from, to: this.to, insert: toMarkdown(prochaine) },
      });
    };

    const table = document.createElement("table");
    grille.forEach((ligne, y) => {
      const rang = document.createElement("tr");
      ligne.forEach((cellule, x) => {
        const box = document.createElement(y === 0 ? "th" : "td");
        box.textContent = cellule;
        box.contentEditable = "true";
        box.spellcheck = false;
        // On n'ecrit dans le document qu'en quittant la case : sinon chaque
        // frappe reconstruirait le tableau et volerait le curseur.
        box.addEventListener("blur", () => {
          const texte = (box.textContent ?? "").replace(/\s+/g, " ").trim();
          if (texte === grille[y][x]) return;
          const prochaine = grille.map((r) => [...r]);
          prochaine[y][x] = texte;
          ecrire(prochaine);
        });
        box.addEventListener("keydown", (event) => {
          // Entree valide la case au lieu d'y ajouter une ligne.
          if (event.key === "Enter") {
            event.preventDefault();
            box.blur();
          }
        });
        rang.appendChild(box);
      });
      table.appendChild(rang);
    });
    frame.appendChild(table);

    const largeur = grille[0]?.length ?? 1;
    frame.appendChild(
      poignee("cm-table__row", "Ajouter une ligne", () =>
        ecrire([...grille.map((r) => [...r]), Array(largeur).fill("")]),
      ),
    );
    frame.appendChild(
      poignee("cm-table__col", "Ajouter une colonne", () =>
        ecrire(grille.map((r) => [...r, ""])),
      ),
    );
    return frame;
  }
}

/** Un bouton discret le long du tableau, revele au survol. */
function poignee(classe: string, titre: string, action: () => void): HTMLElement {
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = classe;
  bouton.title = titre;
  bouton.setAttribute("aria-label", titre);
  bouton.textContent = "+";
  bouton.addEventListener("mousedown", (event) => event.preventDefault());
  bouton.addEventListener("click", action);
  return bouton;
}

/** Lit un tableau markdown, sans sa ligne de separation. */
function parseTable(source: string): string[][] {
  const lignes = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index) => !(index === 1 && /^\|?[\s:|-]+\|?$/.test(line)));
  const grille = lignes.map(splitRow);
  const largeur = Math.max(1, ...grille.map((r) => r.length));
  return grille.map((r) => [...r, ...Array(largeur - r.length).fill("")]);
}

/** Reecrit la grille en markdown ordinaire. */
function toMarkdown(grille: string[][]): string {
  const ligne = (cellules: string[]) => `| ${cellules.map((c) => c || " ").join(" | ")} |`;
  const largeur = grille[0]?.length ?? 1;
  return [
    ligne(grille[0] ?? []),
    `| ${Array(largeur).fill("---").join(" | ")} |`,
    ...grille.slice(1).map(ligne),
  ].join("\n");
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

/**
 * L'etiquette de langage, en tete d'un bloc de code.
 *
 * Elle remplace les trois accents graves et le nom du langage : on ne voit
 * jamais la syntaxe, seulement une pastille indiquant dans quel langage le bloc
 * est ecrit, et qui s'ouvre pour en changer.
 */
export class LanguageWidget extends WidgetType {
  constructor(
    /** Le nom lisible, ou null quand le bloc n'annonce aucun langage. */
    private readonly langage: string | null,
    /** Ou commence et finit ce qui suit les accents graves, pour le reecrire. */
    private readonly from: number,
    private readonly to: number,
    private readonly onChoisir: (from: number, to: number, courant: string | null) => void,
  ) {
    super();
  }

  eq(other: LanguageWidget) {
    return other.langage === this.langage && other.from === this.from && other.to === this.to;
  }

  toDOM() {
    const pastille = document.createElement("span");
    pastille.className = "cm-langage";
    pastille.setAttribute("role", "button");
    pastille.tabIndex = 0;
    pastille.title = "Changer le langage de ce bloc";

    const nom = document.createElement("span");
    nom.className = "cm-langage__nom";
    nom.textContent = this.langage ?? "Texte brut";
    pastille.append(nom);

    const fleche = document.createElement("span");
    fleche.className = "cm-langage__fleche";
    fleche.textContent = "▾";
    pastille.append(fleche);

    const ouvrir = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onChoisir(this.from, this.to, this.langage);
    };
    pastille.onmousedown = ouvrir;
    pastille.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") ouvrir(event);
    };
    return pastille;
  }

  ignoreEvent() {
    return false;
  }
}
