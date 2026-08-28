/**
 * Mettre en forme sans jamais voir le code.
 *
 * Chaque action pose ou retire des marqueurs markdown autour de ce qui est
 * selectionne. Le fichier reste du markdown standard — c'est le meme texte que
 * produirait n'importe quel autre editeur — mais on ne l'ecrit jamais a la
 * main : un raccourci ou un bouton s'en charge, et l'apercu vivant montre
 * aussitot le resultat.
 *
 * Deux familles d'actions :
 *
 *   - celles qui entourent une selection — gras, italique, code, barre,
 *     surlignage, formule ;
 *   - celles qui transforment la ligne entiere — titres, listes, citation,
 *     bloc de code, filet.
 *
 * Toutes basculent : appliquer deux fois revient au texte de depart.
 */

import type { EditorState, StateCommand } from "@codemirror/state";
import { EditorSelection } from "@codemirror/state";

/** Les marqueurs qui entourent une selection, et ce qu'ils veulent dire. */
export const ENTOURAGES = {
  gras: { avant: "**", apres: "**" },
  italique: { avant: "*", apres: "*" },
  code: { avant: "`", apres: "`" },
  barre: { avant: "~~", apres: "~~" },
  /** Extension hors CommonMark, documentee dans docs/. */
  surlignage: { avant: "==", apres: "==" },
  formule: { avant: "$", apres: "$" },
  exposant: { avant: "^", apres: "^" },
  indice: { avant: "~", apres: "~" },
} as const;

export type Entourage = keyof typeof ENTOURAGES;

/** Les debuts de ligne, et ce qu'ils transforment. */
export const PREFIXES = {
  titre1: "# ",
  titre2: "## ",
  titre3: "### ",
  puce: "- ",
  numero: "1. ",
  tache: "- [ ] ",
  citation: "> ",
} as const;

export type Prefixe = keyof typeof PREFIXES;

/** Tout ce qu'une ligne peut porter en tete, pour le retirer avant d'en poser un autre. */
const TOUT_PREFIXE = /^(\s*)(#{1,6} |> |- \[[ xX]\] |[-*+] |\d+[.)] )?/;

/**
 * Cette selection porte-t-elle deja ces marqueurs ?
 *
 * On regarde des deux cotes : a l'interieur de la selection, comme lorsqu'on a
 * selectionne `**gras**` en entier, et a l'exterieur, comme lorsqu'on n'a
 * selectionne que le mot au milieu des etoiles.
 */
function dejaEntoure(state: EditorState, from: number, to: number, avant: string, apres: string) {
  const dedans = state.sliceDoc(from, to);
  if (dedans.length >= avant.length + apres.length) {
    if (dedans.startsWith(avant) && dedans.endsWith(apres)) {
      return { from, to, interieur: [from + avant.length, to - apres.length] as const };
    }
  }
  const gauche = state.sliceDoc(Math.max(0, from - avant.length), from);
  const droite = state.sliceDoc(to, Math.min(state.doc.length, to + apres.length));
  if (gauche === avant && droite === apres) {
    return { from: from - avant.length, to: to + apres.length, interieur: [from, to] as const };
  }
  return null;
}

/** Pose ou retire des marqueurs autour de chaque selection. */
export function basculerEntourage(quoi: Entourage): StateCommand {
  const { avant, apres } = ENTOURAGES[quoi];
  return ({ state, dispatch }) => {
    const transaction = state.changeByRange((range) => {
      const porte = dejaEntoure(state, range.from, range.to, avant, apres);

      if (porte) {
        // On retire les marqueurs, et la selection garde le texte qu'elle tenait.
        const texte = state.sliceDoc(porte.interieur[0], porte.interieur[1]);
        return {
          changes: { from: porte.from, to: porte.to, insert: texte },
          range: EditorSelection.range(porte.from, porte.from + texte.length),
        };
      }

      const texte = state.sliceDoc(range.from, range.to);
      return {
        changes: { from: range.from, to: range.to, insert: `${avant}${texte}${apres}` },
        // Sans selection, le curseur se pose entre les marqueurs : on ecrit
        // aussitot, deja mis en forme.
        range: range.empty
          ? EditorSelection.cursor(range.from + avant.length)
          : EditorSelection.range(
              range.from + avant.length,
              range.from + avant.length + texte.length,
            ),
      };
    });
    dispatch(state.update(transaction, { scrollIntoView: true, userEvent: "input.format" }));
    return true;
  };
}

/**
 * Change ce que porte le debut de chaque ligne touchee.
 *
 * Reappliquer le meme prefixe le retire : c'est ainsi qu'un titre redevient un
 * paragraphe, sans avoir a effacer les diesesa la main.
 */
export function basculerPrefixe(quoi: Prefixe | null): StateCommand {
  return ({ state, dispatch }) => {
    const prefixe = quoi ? PREFIXES[quoi] : "";
    const lignes = new Set<number>();
    for (const range of state.selection.ranges) {
      const premiere = state.doc.lineAt(range.from).number;
      const derniere = state.doc.lineAt(range.to).number;
      for (let n = premiere; n <= derniere; n += 1) lignes.add(n);
    }

    const changes: { from: number; to: number; insert: string }[] = [];
    // Si toutes les lignes portent deja ce prefixe, l'action le retire.
    const toutes = [...lignes].map((n) => state.doc.line(n));
    // Une case cochee reste une case : demander « case a cocher » sur une tache
    // deja faite doit la rendre au texte ordinaire, pas la decocher.
    const memeGenre = (porte: string) =>
      porte === prefixe ||
      (prefixe === PREFIXES.tache && /^- \[[ xX]\] $/.test(porte)) ||
      (prefixe === PREFIXES.puce && /^[*+] $/.test(porte)) ||
      (prefixe === PREFIXES.numero && /^\d+[.)] $/.test(porte));
    const deja =
      prefixe !== "" &&
      toutes.every((ligne) => memeGenre(TOUT_PREFIXE.exec(ligne.text)?.[2] ?? ""));

    for (const ligne of toutes) {
      const trouve = TOUT_PREFIXE.exec(ligne.text);
      const creux = trouve?.[1] ?? "";
      const ancien = trouve?.[2] ?? "";
      const nouveau = deja ? "" : prefixe;
      if (ancien === nouveau) continue;
      changes.push({
        from: ligne.from,
        to: ligne.from + creux.length + ancien.length,
        insert: creux + nouveau,
      });
    }
    if (!changes.length) return false;
    dispatch(state.update({ changes, userEvent: "input.format" }));
    return true;
  };
}

/** Pose un bloc de code autour de la selection, ou l'en retire. */
export const basculerBlocDeCode: StateCommand = ({ state, dispatch }) => {
  const range = state.selection.main;
  const premiere = state.doc.lineAt(range.from);
  const derniere = state.doc.lineAt(range.to);
  const texte = state.sliceDoc(premiere.from, derniere.to);
  const cloture = /^```[^\n]*\n([\s\S]*)\n```$/.exec(texte);

  dispatch(
    state.update({
      changes: {
        from: premiere.from,
        to: derniere.to,
        insert: cloture ? cloture[1] : `\`\`\`\n${texte}\n\`\`\``,
      },
      userEvent: "input.format",
    }),
  );
  return true;
};

/** Insere un filet horizontal sur sa propre ligne. */
export const insererFilet: StateCommand = ({ state, dispatch }) => {
  const ligne = state.doc.lineAt(state.selection.main.head);
  const vide = ligne.text.trim() === "";
  dispatch(
    state.update({
      changes: { from: ligne.to, to: ligne.to, insert: vide ? "---\n" : "\n\n---\n" },
      selection: { anchor: ligne.to + (vide ? 4 : 6) },
      userEvent: "input.format",
    }),
  );
  return true;
};

/**
 * Retire toute mise en forme de la selection.
 *
 * On ne touche qu'aux marqueurs, jamais aux mots : le texte ressort nu, dans
 * l'ordre ou il a ete ecrit.
 */
export const effacerLaMiseEnForme: StateCommand = ({ state, dispatch }) => {
  const transaction = state.changeByRange((range) => {
    if (range.empty) return { range };
    let texte = state.sliceDoc(range.from, range.to);
    texte = texte
      .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
      .replace(/(\*\*|__)(.+?)\1/g, "$2")
      .replace(/(\*|_)(.+?)\1/g, "$2")
      .replace(/~~(.+?)~~/g, "$1")
      .replace(/==(.+?)==/g, "$1")
      .replace(/`([^`]+?)`/g, "$1")
      .replace(/\$([^$]+?)\$/g, "$1")
      // Un lien perd son adresse mais garde son texte.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // Et le debut de ligne perd ce qu'il portait.
      .replace(/^(\s*)(#{1,6} |> |- \[[ xX]\] |[-*+] |\d+[.)] )/gm, "$1");
    return {
      changes: { from: range.from, to: range.to, insert: texte },
      range: EditorSelection.range(range.from, range.from + texte.length),
    };
  });
  dispatch(state.update(transaction, { userEvent: "input.format" }));
  return true;
};

/**
 * Ce que porte la selection en ce moment.
 *
 * Le menu flottant s'en sert pour montrer, d'un coup d'oeil, ce qui est deja
 * applique : un bouton enfonce vaut mieux qu'un bouton a essayer.
 */
export function misesEnFormeActives(state: EditorState): Set<Entourage> {
  const { from, to } = state.selection.main;
  const actives = new Set<Entourage>();
  for (const quoi of Object.keys(ENTOURAGES) as Entourage[]) {
    const { avant, apres } = ENTOURAGES[quoi];
    if (dejaEntoure(state, from, to, avant, apres)) actives.add(quoi);
  }
  // `**gras**` contient `*italique*` : sans cela, tout gras paraitrait italique.
  if (actives.has("gras")) actives.delete("italique");
  if (actives.has("barre")) actives.delete("indice");
  return actives;
}

/** Le niveau de titre de la ligne courante, ou null pour un paragraphe. */
export function blocCourant(state: EditorState): Prefixe | null {
  const ligne = state.doc.lineAt(state.selection.main.head);
  const porte = TOUT_PREFIXE.exec(ligne.text)?.[2] ?? "";
  for (const [nom, prefixe] of Object.entries(PREFIXES)) {
    if (porte === prefixe) return nom as Prefixe;
  }
  // Une liste a puces peut s'ecrire avec `*` ou `+` : c'est la meme chose.
  if (/^[*+] $/.test(porte)) return "puce";
  if (/^\d+[.)] $/.test(porte)) return "numero";
  if (/^- \[[ xX]\] $/.test(porte)) return "tache";
  return null;
}
