/**
 * Les petites icones de la bande de gauche.
 *
 * Un dossier et une note, dessines au trait, dans le meme esprit angulaire que
 * le reste : des lignes franches, aucun arrondi superflu. Elles heritent de la
 * couleur du texte qui les entoure, et suivent donc son survol sans un mot de
 * plus.
 */

interface Props {
  /** Cote de l'icone, en pixels. */
  taille?: number;
}

/** Un dossier : la chemise, sa languette, et le pli du rabat. */
export function IconeDossier({ taille = 13 }: Props) {
  return (
    <svg
      className="icone icone--dossier"
      width={taille}
      height={taille}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      {/* La languette, puis la chemise : un seul trait continu. */}
      <path d="M1.6 12.9V3.1h4.1l1.5 1.9h7.2v7.9z" />
      {/* Le pli du rabat, qui donne l'epaisseur sans surcharger. */}
      <path d="M1.6 6.3h12.8" opacity="0.55" />
    </svg>
  );
}

/** Une note : une feuille, son coin replie, et deux lignes de texte. */
export function IconeNote({ taille = 13 }: Props) {
  return (
    <svg
      className="icone icone--note"
      width={taille}
      height={taille}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      {/* La feuille, dont le coin superieur droit est coupe. */}
      <path d="M3.2 1.7h6.1l3.5 3.5v9.1H3.2z" />
      {/* Le coin replie. */}
      <path d="M9.3 1.7v3.5h3.5" opacity="0.55" />
      {/* Deux lignes de texte, pour qu'on lise « note » d'un coup d'oeil. */}
      <path d="M5.6 8.6h4.8M5.6 11.2h4.8" opacity="0.55" />
    </svg>
  );
}

/**
 * Le panneau lateral, ouvert ou replie.
 *
 * Un cadre, et la colonne de gauche : pleine quand la bande est la, vide quand
 * elle est repliee. On voit d'un coup d'oeil ce que le bouton va faire.
 */
export function IconePanneau({ ouvert = true, taille = 14 }: Props & { ouvert?: boolean }) {
  return (
    <svg
      className="icone icone--panneau"
      width={taille}
      height={taille}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <rect x="1.7" y="2.7" width="12.6" height="10.6" />
      <path d="M6.3 2.7v10.6" />
      {ouvert && <path d="M1.7 2.7h4.6v10.6H1.7z" fill="currentColor" opacity="0.35" stroke="none" />}
    </svg>
  );
}
