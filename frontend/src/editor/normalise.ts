/**
 * Retoucher un bloc sans jamais voir son code.
 *
 * Les marqueurs markdown ne s'affichent plus : devant un titre, on ne lit que
 * « Titre », pas `# Titre`. Pour en changer le niveau, on tape simplement `##`
 * suivi d'une espace au debut de la ligne. Le curseur se posant toujours apres
 * le marqueur invisible, le texte devient un instant `## ### Titre` — que l'on
 * ramene aussitot a `### Titre`. Le second marqueur, celui que l'on vient
 * d'ecrire, remplace le premier, et rien de tout cela n'apparait a l'ecran.
 *
 * Le meme geste vaut pour les citations et les listes.
 */

import { EditorState, Transaction, type Extension } from "@codemirror/state";

/** Tout ce qui peut ouvrir une ligne en markdown. */
const MARQUEUR = String.raw`(?:#{1,6}|>|[-*+]|\d+\.)`;

/** Deux marqueurs de suite : c'est le second, celui que l'on tape, qui gagne. */
const DOUBLON = new RegExp(`^(${MARQUEUR} +)(${MARQUEUR} )`);

export function normaliseMarqueurs(): Extension {
  return EditorState.transactionFilter.of((transaction: Transaction) => {
    if (!transaction.docChanged) return transaction;

    const apres = transaction.newDoc;
    const tete = transaction.newSelection.main.head;
    if (tete > apres.length) return transaction;

    const ligne = apres.lineAt(tete);
    const trouve = DOUBLON.exec(ligne.text);
    if (!trouve) return transaction;

    // On ne touche qu'au marqueur devenu inutile — surtout pas a toute la
    // ligne, dont le remplacement emporterait aussi ce qui la suit.
    const ancien = trouve[1];
    return [
      transaction,
      {
        changes: { from: ligne.from, to: ligne.from + ancien.length, insert: "" },
        selection: { anchor: Math.max(ligne.from, tete - ancien.length) },
        // Cette retouche accompagne la frappe : elle ne merite pas son propre
        // pas dans l'historique.
        annotations: Transaction.addToHistory.of(false),
      },
    ];
  });
}
