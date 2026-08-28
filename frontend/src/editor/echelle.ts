/**
 * Convertir ce que l'on mesure en ce que l'on peut positionner.
 *
 * L'application est agrandie d'un cran : un rectangle se mesure en pixels
 * d'ecran, alors qu'une position `left` ou `top` s'ecrit en pixels de mise en
 * page. Melanger les deux decale tout ce qu'on pose au-dessus du texte — une
 * barre flottante finit par recouvrir la ligne qu'elle devait surmonter.
 *
 * Le rapport se lit sur la page elle-meme, et vaut simplement 1 quand rien
 * n'est agrandi.
 */

/**
 * Le rapport entre un pixel d'ecran et un pixel de mise en page.
 *
 * On le lit sur le corps de la page, pas sur sa racine : l'agrandissement est
 * pose sur la racine, qui ajuste alors ses propres mesures et ne montre plus
 * aucun ecart. C'est le premier element en dessous qui le revele.
 */
export function facteurDEchelle(): number {
  if (typeof document === "undefined") return 1;
  const corps = document.body;
  const largeur = corps?.clientWidth ?? 0;
  if (!largeur) return 1;
  const mesure = corps.getBoundingClientRect().width / largeur;
  return Number.isFinite(mesure) && mesure > 0 ? mesure : 1;
}

/** La fenetre, exprimee en pixels de mise en page. */
export function fenetreEnPixelsDeMiseEnPage() {
  const facteur = facteurDEchelle();
  return {
    largeur: document.documentElement.clientWidth / facteur,
    hauteur: document.documentElement.clientHeight / facteur,
  };
}

/** Un rectangle d'ecran, ramene en pixels de mise en page. */
export function enPixelsDeMiseEnPage(rect: {
  left: number;
  right: number;
  top: number;
  bottom: number;
}) {
  const facteur = facteurDEchelle();
  return {
    left: rect.left / facteur,
    right: rect.right / facteur,
    top: rect.top / facteur,
    bottom: rect.bottom / facteur,
    largeur: (rect.right - rect.left) / facteur,
    hauteur: (rect.bottom - rect.top) / facteur,
  };
}
