/**
 * Apercu vivant : le markdown s'affiche deja mis en forme pendant qu'on l'ecrit.
 *
 * Taper `# ` puis un titre donne immediatement un titre ; `---` devient un trait ;
 * `- [ ]` devient une case a cocher. La syntaxe ne reapparait que quand le curseur
 * entre dans l'element concerne, pour pouvoir le corriger.
 *
 * Le fichier ecrit sur le disque, lui, reste du markdown parfaitement ordinaire.
 *
 * Le rendu se fait en deux temps, parce que CodeMirror l'impose :
 *
 * - ce qui tient sur une ligne (titres, gras, cases a cocher, images) est calcule
 *   par un plugin, qui ne travaille que sur la portion visible a l'ecran ;
 * - ce qui enjambe plusieurs lignes (tableaux, formules en bloc) doit venir d'un
 *   champ d'etat : un plugin n'a pas le droit de remplacer un saut de ligne.
 */

import { syntaxTree } from "@codemirror/language";
import { StateField, type EditorState, type Extension, type Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { CheckboxWidget, ImageWidget, MathWidget, RuleWidget, TableWidget } from "./widgets";

const HIDE = Decoration.replace({});

const LINE_CLASS: Record<string, string> = {
  ATXHeading1: "cm-h1",
  ATXHeading2: "cm-h2",
  ATXHeading3: "cm-h3",
  ATXHeading4: "cm-h4",
  ATXHeading5: "cm-h5",
  ATXHeading6: "cm-h6",
  Blockquote: "cm-quote",
  FencedCode: "cm-code-block",
  CodeBlock: "cm-code-block",
};

const INLINE_CLASS: Record<string, string> = {
  StrongEmphasis: "cm-strong",
  Emphasis: "cm-em",
  Strikethrough: "cm-strike",
  InlineCode: "cm-code",
};

const MARK_NODES = new Set(["EmphasisMark", "StrikethroughMark", "CodeMark"]);

/**
 * Vrai si le curseur touche cette portee, marqueurs compris.
 *
 * `reveal` est faux en lecture : la syntaxe ne doit alors jamais reapparaitre,
 * pas meme sous le curseur invisible que garde un editeur verrouille.
 */
function near(state: EditorState, from: number, to: number, reveal: boolean): boolean {
  return reveal && state.selection.ranges.some((range) => range.from <= to && range.to >= from);
}

/** Vrai si le curseur est pose quelque part sur la ligne de cette portee. */
function onLine(state: EditorState, from: number, to: number): boolean {
  const debut = state.doc.lineAt(from).from;
  const fin = state.doc.lineAt(Math.min(to, state.doc.length)).to;
  return state.selection.ranges.some((range) => range.from <= fin && range.to >= debut);
}

/**
 * Faut-il montrer le markdown brut de ce bloc ?
 *
 * Poser le curseur sur la ligne devoile la syntaxe — `# Titre` reapparait, on
 * corrige, on repart. Mais pendant la frappe elle reste cachee : taper « # »
 * puis un texte donne un titre tout de suite, sans voir le diese.
 */
function revealBlock(
  state: EditorState,
  typing: boolean,
  reveal: boolean,
  from: number,
  to: number,
): boolean {
  return reveal && !typing && onLine(state, from, to);
}

// ---------------------------------------------------------------- Blocs

const BLOCK_MATH = /\$\$([\s\S]+?)\$\$/g;

/** Tableaux et formules en bloc : tout ce qui enjambe plusieurs lignes. */
function buildBlocks(state: EditorState, reveal: boolean): DecorationSet {
  const marks: Range<Decoration>[] = [];
  const taken: { from: number; to: number }[] = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== "Table") return undefined;
      if (near(state, node.from, node.to, reveal)) return false;
      const source = state.sliceDoc(node.from, node.to);
      marks.push(
        Decoration.replace({ widget: new TableWidget(source), block: true }).range(
          node.from,
          node.to,
        ),
      );
      taken.push({ from: node.from, to: node.to });
      return false;
    },
  });

  const text = state.doc.toString();
  for (const match of text.matchAll(BLOCK_MATH)) {
    if (!match[0].includes("\n")) continue; // une formule sur une ligne reste en ligne
    const start = match.index;
    const end = start + match[0].length;
    if (taken.some((range) => range.from < end && range.to > start)) continue;
    if (near(state, start, end, reveal)) continue;
    // Un widget de bloc doit couvrir des lignes entieres.
    const from = state.doc.lineAt(start).from;
    const to = state.doc.lineAt(end).to;
    if (state.sliceDoc(from, start).trim() || state.sliceDoc(end, to).trim()) continue;
    marks.push(
      Decoration.replace({ widget: new MathWidget(match[1].trim(), true), block: true }).range(
        from,
        to,
      ),
    );
  }

  return Decoration.set(marks, true);
}

/** Un champ par editeur : ecriture et lecture ne se comportent pas pareil. */
function makeBlockField(reveal: boolean) {
  return StateField.define<DecorationSet>({
    create: (state) => buildBlocks(state, reveal),
    update(value, transaction) {
      // La selection compte autant que le texte : c'est elle qui decide quand un
      // tableau redevient modifiable.
      return transaction.docChanged || transaction.selection
        ? buildBlocks(transaction.state, reveal)
        : value;
    },
    provide: (field) => EditorView.decorations.from(field),
  });
}

type BlockField = ReturnType<typeof makeBlockField>;

// ---------------------------------------------------------------- Lignes

const EMBED = /!\[\[([^\]\n]+?)\]\]/g;
const WIKILINK = /(!?)\[\[([^\]\n]+?)\]\]/g;
const INLINE_MATH = /\$([^$\n]+?)\$/g;

function buildInline(
  view: EditorView,
  typing: boolean,
  reveal: boolean,
  blockField: BlockField,
): DecorationSet {
  const { state } = view;
  const marks: Range<Decoration>[] = [];
  const consumed: { from: number; to: number }[] = [];

  // Ce que les blocs remplacent deja doit rester intouche.
  const blocks = state.field(blockField, false);
  blocks?.between(0, state.doc.length, (from, to) => {
    consumed.push({ from, to });
  });

  const free = (from: number, to: number) =>
    !consumed.some((range) => range.from < to && range.to > from);

  const replace = (from: number, to: number, decoration: Decoration) => {
    if (!free(from, to)) return;
    marks.push(decoration.range(from, to));
    consumed.push({ from, to });
  };

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name;

        // Le tableau est deja traite comme un bloc.
        if (name === "Table") return near(state, node.from, node.to, reveal) ? undefined : false;

        if (name === "HorizontalRule") {
          // Des le troisieme tiret tape, le trait apparait ; y reposer le
          // curseur ramene les « --- » pour pouvoir les effacer.
          if (revealBlock(state, typing, reveal, node.from, node.to)) return false;
          replace(node.from, node.to, Decoration.replace({ widget: new RuleWidget() }));
          return false;
        }

        if (name === "Image") {
          if (near(state, node.from, node.to, reveal)) return false;
          const parsed = /^!\[([^\]]*)\]\(([^)]+)\)/.exec(state.sliceDoc(node.from, node.to));
          if (!parsed) return false;
          replace(
            node.from,
            node.to,
            Decoration.replace({ widget: new ImageWidget(parsed[2].trim(), parsed[1].trim()) }),
          );
          return false;
        }

        const lineClass = LINE_CLASS[name];
        if (lineClass) {
          const first = state.doc.lineAt(node.from).number;
          const last = state.doc.lineAt(Math.min(node.to, state.doc.length)).number;
          for (let number = first; number <= last; number += 1) {
            marks.push(Decoration.line({ class: lineClass }).range(state.doc.line(number).from));
          }
        }

        if (name === "HeaderMark" || name === "QuoteMark") {
          if (revealBlock(state, typing, reveal, node.from, node.to)) return false;
          // Le marqueur et l'espace qui le suit partent ensemble.
          const end = state.sliceDoc(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
          replace(node.from, end, HIDE);
          return false;
        }

        if (name === "TaskMarker") {
          const checked = state.sliceDoc(node.from + 1, node.to - 1).trim().toLowerCase() === "x";
          replace(
            node.from,
            node.to,
            Decoration.replace({ widget: new CheckboxWidget(checked, node.from) }),
          );
          // La case tient lieu de puce : la ligne ne doit pas en porter deux.
          marks.push(
            Decoration.line({ class: "cm-task-line" }).range(state.doc.lineAt(node.from).from),
          );
          return false;
        }

        if (name === "ListMark") {
          const text = state.sliceDoc(node.from, node.to);
          const puce = text === "-" || text === "*" || text === "+";
          marks.push(
            Decoration.mark({ class: puce ? "cm-bullet" : "cm-list-number" }).range(
              node.from,
              node.to,
            ),
          );
          return false;
        }

        const inlineClass = INLINE_CLASS[name];
        if (inlineClass) {
          marks.push(Decoration.mark({ class: inlineClass }).range(node.from, node.to));
          return undefined;
        }

        if (MARK_NODES.has(name)) {
          const parent = node.node.parent;
          if (parent && !near(state, parent.from, parent.to, reveal)) {
            replace(node.from, node.to, HIDE);
          }
          return false;
        }

        if (name === "Link") {
          if (near(state, node.from, node.to, reveal)) return undefined;
          const parsed = /^\[([^\]]*)\]\(([^)]+)\)/.exec(state.sliceDoc(node.from, node.to));
          if (!parsed) return undefined;
          // Ne reste a l'ecran que le texte du lien.
          const label = node.from + 1;
          replace(node.from, label, HIDE);
          marks.push(
            Decoration.mark({ class: "cm-link" }).range(label, label + parsed[1].length),
          );
          replace(label + parsed[1].length, node.to, HIDE);
          return false;
        }

        return undefined;
      },
    });
  }

  // Ce que l'analyseur markdown ne connait pas : [[liens]], ![[images]], $maths$.
  for (const { from, to } of view.visibleRanges) {
    scanExtras(state.sliceDoc(from, to), from, state, reveal, marks, free, replace);
  }

  return Decoration.set(marks, true);
}

function scanExtras(
  text: string,
  offset: number,
  state: EditorState,
  reveal: boolean,
  marks: Range<Decoration>[],
  free: (from: number, to: number) => boolean,
  replace: (from: number, to: number, decoration: Decoration) => void,
) {
  // Images embarquees : ![[schema.png]] trouve l'image ou qu'elle soit dans le Vault.
  for (const match of text.matchAll(EMBED)) {
    const start = offset + match.index;
    const end = start + match[0].length;
    if (!free(start, end) || near(state, start, end, reveal)) continue;
    replace(start, end, Decoration.replace({ widget: new ImageWidget(match[1].trim(), "") }));
  }

  // Liens vers d'autres notes.
  for (const match of text.matchAll(WIKILINK)) {
    if (match[1] === "!") continue; // deja traite comme image
    const start = offset + match.index;
    const end = start + match[0].length;
    if (!free(start, end)) continue;
    const inner = match[2];
    const target = inner.split("|")[0].split("#")[0].trim();
    const shown = inner.includes("|") ? inner.split("|")[1].trim() : inner.trim();

    if (near(state, start, end, reveal)) {
      marks.push(Decoration.mark({ class: "cm-wikilink is-raw" }).range(start, end));
      continue;
    }
    const label = start + 2 + inner.indexOf(shown);
    replace(start, label, HIDE);
    marks.push(
      Decoration.mark({
        class: "cm-wikilink",
        attributes: { "data-target": target },
      }).range(label, label + shown.length),
    );
    replace(label + shown.length, end, HIDE);
  }

  // Formules tenant sur une ligne.
  for (const match of text.matchAll(INLINE_MATH)) {
    // Un « $ » echappe ou double appartient a autre chose.
    const before = text[match.index - 1];
    if (before === "\\" || before === "$") continue;
    const start = offset + match.index;
    const end = start + match[0].length;
    if (!free(start, end) || near(state, start, end, reveal)) continue;
    const bloc = match[1].startsWith("$") && match[1].endsWith("$");
    const formula = bloc ? match[1].slice(1, -1).trim() : match[1].trim();
    replace(start, end, Decoration.replace({ widget: new MathWidget(formula, bloc) }));
  }
}

// ---------------------------------------------------------------- Assemblage

export function livePreview(
  onFollowLink: (target: string) => void,
  /** Faux en lecture : le texte est alors purement consultatif, sans syntaxe. */
  reveal = true,
): Extension {
  const blockField = makeBlockField(reveal);

  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      /** Vrai tant que la derniere action etait une frappe, pas un deplacement. */
      private typing = true;

      constructor(view: EditorView) {
        this.decorations = buildInline(view, this.typing, reveal, blockField);
      }

      update(update: ViewUpdate) {
        // Ecrire cache la syntaxe ; deplacer le curseur la devoile. Taper modifie
        // aussi la selection, d'ou l'ordre : le texte l'emporte.
        if (update.docChanged) this.typing = true;
        else if (update.selectionSet) this.typing = false;

        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildInline(update.view, this.typing, reveal, blockField);
        }
      }
    },
    { decorations: (instance) => instance.decorations },
  );

  const clicks = EditorView.domEventHandlers({
    mousedown(event) {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(".cm-wikilink");
      if (!target) return false;
      event.preventDefault();
      onFollowLink(target.dataset.target ?? "");
      return true;
    },
  });

  return [blockField, plugin, clicks];
}
