/**
 * Le « + » qui suit la ligne survolee.
 *
 * Plutot qu'un bouton unique en haut de la note, une poignee vient se poser
 * discretement devant la ligne que l'on survole, et s'efface des qu'on s'en va.
 * C'est la ligne visee qui recoit ce que l'on insere.
 */

import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

/** Ce que l'editeur signale a l'interface : ou poser la poignee, et pour quelle ligne. */
export interface HoveredLine {
  /** Position verticale de la ligne, en pixels, dans la zone d'ecriture. */
  top: number;
  /** Debut de la ligne dans le document. */
  from: number;
}

export function lineHandle(onHover: (line: HoveredLine | null) => void) {
  return ViewPlugin.fromClass(
    class {
      private courante: number | null = null;

      constructor(readonly view: EditorView) {}

      /** Oublie la poignee quand le texte defile ou change sous elle. */
      update(update: ViewUpdate) {
        if (update.geometryChanged || update.docChanged) this.efface();
      }

      destroy() {
        this.efface();
      }

      private efface() {
        if (this.courante === null) return;
        this.courante = null;
        onHover(null);
      }

      signale(event: MouseEvent) {
        const view = this.view;
        const boite = view.scrollDOM.getBoundingClientRect();
        const position = view.posAtCoords({ x: boite.left + 40, y: event.clientY });
        if (position === null) return this.efface();

        const ligne = view.lineBlockAt(position);
        if (ligne.from === this.courante) return;
        this.courante = ligne.from;
        onHover({ top: ligne.top - view.scrollDOM.scrollTop, from: ligne.from });
      }
    },
    {
      eventHandlers: {
        mousemove(event) {
          this.signale(event as MouseEvent);
        },
        mouseleave() {
          // On ne s'efface pas ici : la poignee elle-meme est en dehors du
          // texte, et la quitter ferait clignoter le bouton.
        },
      },
    },
  );
}
