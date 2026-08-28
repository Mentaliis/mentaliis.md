/**
 * La barre de mise en forme, au-dessus de ce qu'on vient de selectionner.
 *
 * Elle ne sait rien du texte ni du fichier : elle recoit ce qui est deja
 * applique, ou se placer, et previent d'un seul appel quand on choisit. Toute
 * la logique markdown vit dans `formatage.ts`.
 *
 * Chaque bouton porte le raccourci qui fait la meme chose : le menu apprend
 * les raccourcis a mesure qu'on s'en sert.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { enPixelsDeMiseEnPage, fenetreEnPixelsDeMiseEnPage } from "./echelle";
import type { Entourage, Prefixe } from "./formatage";
import { RACCOURCIS, libelle } from "./raccourcis";

/** Tout ce que la barre sait demander. */
export type ActionDeMiseEnForme =
  | { quoi: "entourage"; nom: Entourage }
  | { quoi: "bloc"; nom: Prefixe | null }
  | { quoi: "lien" }
  | { quoi: "effacer" };

interface Props {
  /** Le rectangle de la selection, en pixels de la fenetre. */
  selection: { left: number; right: number; top: number; bottom: number };
  /** Ce que la selection porte deja : les boutons correspondants sont enfonces. */
  actives: Set<Entourage>;
  /** Le type de la ligne courante, pour le menu deroulant de gauche. */
  bloc: Prefixe | null;
  onAction: (action: ActionDeMiseEnForme) => void;
  onClose: () => void;
}

const NOMS_DE_BLOC: Record<string, string> = {
  paragraphe: "Texte normal",
  titre1: "Titre 1",
  titre2: "Titre 2",
  titre3: "Titre 3",
  puce: "Liste a puces",
  numero: "Liste numerotee",
  tache: "Case a cocher",
  citation: "Citation",
};

const BLOCS: (Prefixe | null)[] = [
  null,
  "titre1",
  "titre2",
  "titre3",
  "puce",
  "numero",
  "tache",
  "citation",
];

export function FloatingFormatMenu({ selection, actives, bloc, onAction, onClose }: Props) {
  const barre = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number; dessous: boolean } | null>(null);
  const [blocsOuverts, setBlocsOuverts] = useState(false);

  // On mesure la barre avant de la montrer : sans cela elle apparaitrait une
  // fraction de seconde au mauvais endroit, puis sauterait a sa place.
  useLayoutEffect(() => {
    const element = barre.current;
    if (!element) return;
    // Tout se ramene en pixels de mise en page : c'est dans cette unite que
    // s'ecrivent `left` et `top`, et l'application est agrandie d'un cran.
    const taille = enPixelsDeMiseEnPage(element.getBoundingClientRect());
    const cible = enPixelsDeMiseEnPage(selection);
    const fenetre = fenetreEnPixelsDeMiseEnPage();
    const marge = 10;

    // Au-dessus de la selection, sauf s'il n'y a pas la place : elle bascule
    // alors en dessous plutot que de sortir de l'ecran.
    const dessous = cible.top - taille.hauteur - marge < 8;
    const top = dessous ? cible.bottom + marge : cible.top - taille.hauteur - marge;

    const milieu = (cible.left + cible.right) / 2;
    const left = Math.min(
      Math.max(8, milieu - taille.largeur / 2),
      fenetre.largeur - taille.largeur - 8,
    );
    setPlace({ left, top, dessous });
  }, [selection]);

  useEffect(() => {
    const auClavier = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", auClavier, true);
    return () => window.removeEventListener("keydown", auClavier, true);
  }, [onClose]);

  /** Un bouton d'action : son icone, ce qu'il fait, et le raccourci qui le double. */
  const bouton = (
    cle: string,
    contenu: React.ReactNode,
    titre: string,
    raccourci: string | null,
    action: ActionDeMiseEnForme,
    actif = false,
  ) => (
    <button
      key={cle}
      type="button"
      className={`formatage__bouton${actif ? " is-active" : ""}`}
      title={raccourci ? `${titre} (${libelle(raccourci)})` : titre}
      aria-label={titre}
      aria-pressed={actif}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onAction(action)}
    >
      {contenu}
    </button>
  );

  return (
    <div
      ref={barre}
      className={`formatage${place?.dessous ? " is-dessous" : ""}`}
      style={{
        left: place?.left ?? -9999,
        top: place?.top ?? -9999,
        visibility: place ? "visible" : "hidden",
      }}
      role="toolbar"
      aria-label="Mise en forme"
      onMouseDown={(event) => event.preventDefault()}
    >
      {/* Le type de bloc, a gauche, comme un intitule qu'on deroule. */}
      <div className="formatage__bloc">
        <button
          type="button"
          className="formatage__bouton formatage__bouton--large"
          aria-haspopup="menu"
          aria-expanded={blocsOuverts}
          title="Changer le type de bloc"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setBlocsOuverts((ouvert) => !ouvert)}
        >
          {NOMS_DE_BLOC[bloc ?? "paragraphe"]}
          <span className="formatage__chevron">▾</span>
        </button>
        {blocsOuverts && (
          <div className="formatage__blocs" role="menu">
            {BLOCS.map((nom) => (
              <button
                key={nom ?? "paragraphe"}
                type="button"
                role="menuitem"
                className={`formatage__choix${nom === bloc ? " is-courant" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setBlocsOuverts(false);
                  onAction({ quoi: "bloc", nom });
                }}
              >
                {NOMS_DE_BLOC[nom ?? "paragraphe"]}
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="formatage__separateur" />

      {bouton(
        "surlignage",
        <span className="formatage__lettre formatage__lettre--surligne">A</span>,
        "Surligner",
        RACCOURCIS.surlignage,
        { quoi: "entourage", nom: "surlignage" },
        actives.has("surlignage"),
      )}
      {bouton(
        "gras",
        <strong className="formatage__lettre">B</strong>,
        "Gras",
        RACCOURCIS.gras,
        { quoi: "entourage", nom: "gras" },
        actives.has("gras"),
      )}
      {bouton(
        "italique",
        <em className="formatage__lettre">I</em>,
        "Italique",
        RACCOURCIS.italique,
        { quoi: "entourage", nom: "italique" },
        actives.has("italique"),
      )}
      {bouton(
        "barre",
        <s className="formatage__lettre">S</s>,
        "Barre",
        RACCOURCIS.barre,
        { quoi: "entourage", nom: "barre" },
        actives.has("barre"),
      )}
      {bouton(
        "effacer",
        <span className="formatage__lettre">T✕</span>,
        "Effacer la mise en forme",
        RACCOURCIS.effacer,
        { quoi: "effacer" },
      )}

      <span className="formatage__separateur" />

      {bouton("lien", <IconeLien />, "Lien", RACCOURCIS.lien, { quoi: "lien" })}
      {bouton(
        "code",
        <span className="formatage__lettre formatage__lettre--mono">{"</>"}</span>,
        "Code en ligne",
        RACCOURCIS.code,
        { quoi: "entourage", nom: "code" },
        actives.has("code"),
      )}
      {bouton(
        "formule",
        <span className="formatage__lettre">√x</span>,
        "Formule",
        RACCOURCIS.formule,
        { quoi: "entourage", nom: "formule" },
        actives.has("formule"),
      )}
    </div>
  );
}

/** Un maillon de chaine, pour le bouton de lien. */
function IconeLien() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2.4-2.4a2.6 2.6 0 0 0-3.7-3.7l-1 1" />
      <path d="M9.4 6.6a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l1-1" />
    </svg>
  );
}
