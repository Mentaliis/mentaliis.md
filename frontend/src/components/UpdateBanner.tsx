/**
 * Le bandeau qui annonce une version plus recente.
 *
 * Il se glisse en bas a droite, sans rien interrompre : on peut continuer a
 * ecrire, l'ignorer, ou installer. Rien ne s'installe sans un clic.
 */

import type { UpdateState } from "../lib/useUpdater";

interface Props {
  state: UpdateState;
  onInstall: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ state, onInstall, onDismiss }: Props) {
  // Les etats muets : rien a montrer tant qu'il n'y a rien a dire. Une
  // recherche automatique qui echoue en fait partie — elle se raconte dans les
  // parametres, pas en travers de l'ecran.
  if (
    state.etat === "repos" ||
    state.etat === "recherche" ||
    state.etat === "a-jour" ||
    state.etat === "muet"
  ) {
    return null;
  }

  if (state.etat === "echec") {
    return (
      <div className="maj maj--echec" role="status">
        <span className="maj__titre">Mise a jour impossible</span>
        <button type="button" className="maj__fermer" onClick={onDismiss} title="Fermer">
          ×
        </button>
      </div>
    );
  }

  if (state.etat === "telechargement" || state.etat === "installation") {
    const fini = state.etat === "installation";
    return (
      <div className="maj" role="status">
        <span className="maj__titre">
          {fini ? "Installation…" : "Telechargement…"}
        </span>
        <div className="maj__jauge">
          <div
            className="maj__jauge-remplie"
            style={{ width: fini ? "100%" : `${Math.round(state.progres * 100)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="maj" role="status">
      <div className="maj__texte">
        <span className="maj__titre">Mentaliis {state.version} est disponible</span>
        {state.notes ? <span className="maj__notes">{state.notes}</span> : null}
      </div>
      <div className="maj__actions">
        <button type="button" className="maj__plus-tard" onClick={onDismiss}>
          Plus tard
        </button>
        <button type="button" className="maj__installer" onClick={onInstall}>
          Installer et relancer
        </button>
      </div>
    </div>
  );
}
