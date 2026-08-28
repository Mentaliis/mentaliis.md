/**
 * Les raccourcis de mise en forme.
 *
 * Ils suivent les conventions que tout le monde connait — celles de Notion,
 * de Word, des traitements de texte : Ctrl+B pour le gras, Ctrl+I pour
 * l'italique. On n'ecrit jamais les marqueurs a la main.
 *
 * `Mod` vaut Ctrl sous Windows et Linux, Cmd sur un Mac : CodeMirror s'en
 * charge, et le meme raccourci fonctionne partout sans qu'on ait a le dire
 * deux fois.
 */

import type { KeyBinding } from "@codemirror/view";
import {
  basculerBlocDeCode,
  basculerEntourage,
  basculerPrefixe,
  effacerLaMiseEnForme,
  insererFilet,
} from "./formatage";

/** Ce qu'on affiche a l'utilisateur, pour le systeme sur lequel il travaille. */
export const MOD = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)
  ? "Cmd"
  : "Ctrl";

/** Le libelle d'un raccourci, tel qu'on le montre dans une infobulle. */
export function libelle(touches: string): string {
  return touches.replace("Mod", MOD).replace(/-/g, " + ");
}

/**
 * Les raccourcis de mise en forme, dans l'ordre ou on les explique.
 *
 * Le libelle sert aux infobulles du menu flottant : le bouton et le raccourci
 * disent exactement la meme chose, et l'un apprend l'autre.
 */
export const RACCOURCIS = {
  gras: "Mod-b",
  italique: "Mod-i",
  code: "Mod-e",
  barre: "Mod-Shift-s",
  surlignage: "Mod-Shift-h",
  formule: "Mod-Shift-e",
  lien: "Mod-Shift-k",
  effacer: "Mod-Shift-n",
  titre1: "Mod-Shift-1",
  titre2: "Mod-Shift-2",
  titre3: "Mod-Shift-3",
  paragraphe: "Mod-Shift-0",
  puce: "Mod-Shift-9",
  numero: "Mod-Shift-7",
  tache: "Mod-Shift-6",
  citation: "Mod-Shift-q",
  blocDeCode: "Mod-Shift-c",
  filet: "Mod-Shift-m",
} as const;

export type Raccourci = keyof typeof RACCOURCIS;

/**
 * Le clavier de la mise en forme.
 *
 * `onLien` est confie par l'editeur : poser un lien demande une adresse, donc
 * une boite de dialogue, qui n'a pas sa place ici.
 */
export function raccourcisDeMiseEnForme(onLien: () => void): KeyBinding[] {
  return [
    { key: RACCOURCIS.gras, run: basculerEntourage("gras"), preventDefault: true },
    { key: RACCOURCIS.italique, run: basculerEntourage("italique"), preventDefault: true },
    { key: RACCOURCIS.code, run: basculerEntourage("code"), preventDefault: true },
    { key: RACCOURCIS.barre, run: basculerEntourage("barre"), preventDefault: true },
    { key: RACCOURCIS.surlignage, run: basculerEntourage("surlignage"), preventDefault: true },
    { key: RACCOURCIS.formule, run: basculerEntourage("formule"), preventDefault: true },
    {
      key: RACCOURCIS.lien,
      run: () => {
        onLien();
        return true;
      },
      preventDefault: true,
    },
    { key: RACCOURCIS.effacer, run: effacerLaMiseEnForme, preventDefault: true },

    { key: RACCOURCIS.paragraphe, run: basculerPrefixe(null), preventDefault: true },
    { key: RACCOURCIS.titre1, run: basculerPrefixe("titre1"), preventDefault: true },
    { key: RACCOURCIS.titre2, run: basculerPrefixe("titre2"), preventDefault: true },
    { key: RACCOURCIS.titre3, run: basculerPrefixe("titre3"), preventDefault: true },
    { key: RACCOURCIS.puce, run: basculerPrefixe("puce"), preventDefault: true },
    { key: RACCOURCIS.numero, run: basculerPrefixe("numero"), preventDefault: true },
    { key: RACCOURCIS.tache, run: basculerPrefixe("tache"), preventDefault: true },
    { key: RACCOURCIS.citation, run: basculerPrefixe("citation"), preventDefault: true },
    { key: RACCOURCIS.blocDeCode, run: basculerBlocDeCode, preventDefault: true },
    { key: RACCOURCIS.filet, run: insererFilet, preventDefault: true },
  ];
}
