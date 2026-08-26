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
  /** Haut du texte de la ligne, en pixels, dans la zone d'ecriture. */
  top: number;
  /** Hauteur de ce texte, pour centrer la poignee dessus. */
  height: number;
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

        // On vise le texte, pas le bloc : un grand titre porte un large blanc
        // au-dessus de lui, et la poignee se poserait alors trop haut.
        const element = this.ligneDe(ligne.from);
        if (!element) return;

        // L'application est agrandie : les rectangles se mesurent en pixels
        // d'ecran, alors qu'une position `top` s'ecrit en pixels de mise en
        // page. Le rapport entre les deux se lit sur le cadre lui-meme, et vaut
        // simplement 1 quand rien n'est agrandi.
        const cadre = view.scrollDOM.getBoundingClientRect();
        const facteur = view.scrollDOM.clientHeight
          ? cadre.height / view.scrollDOM.clientHeight
          : 1;

        const style = getComputedStyle(element);
        const haut = parseFloat(style.paddingTop) || 0;
        const bas = parseFloat(style.paddingBottom) || 0;
        const rect = element.getBoundingClientRect();

        this.courante = ligne.from;
        onHover({
          top: (rect.top - cadre.top) / facteur + haut,
          height: Math.max(0, rect.height / facteur - haut - bas),
          from: ligne.from,
        });
      }

      /** L'element de ligne qui porte cette position, pour lire son remplissage. */
      private ligneDe(position: number): HTMLElement | null {
        const { node } = this.view.domAtPos(position);
        const depart =
          node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
        return depart?.closest<HTMLElement>(".cm-line") ?? null;
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
