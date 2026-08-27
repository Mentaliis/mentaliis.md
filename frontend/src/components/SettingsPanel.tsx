/** La page des reglages. */

import { useEffect } from "react";
import type { Settings, VaultInfo } from "../lib/types";
import type { UpdateState } from "../lib/useUpdater";

const AGRANDISSEMENTS: { valeur: 1 | 2 | 3; nom: string; detail: string }[] = [
  { valeur: 1, nom: "1×", detail: "Taille normale" },
  { valeur: 2, nom: "2×", detail: "Un cran plus grand" },
  { valeur: 3, nom: "3×", detail: "Encore un cran" },
];

interface Props {
  settings: Settings;
  vault: VaultInfo | null;
  onChange: (change: Partial<Settings>) => void;
  onChangeVault: () => void;
  onClose: () => void;
  updateState: UpdateState;
  onCheckUpdate: () => void;
  onInstallUpdate: () => void;
}

export function SettingsPanel({
  settings,
  vault,
  onChange,
  onChangeVault,
  onClose,
  updateState,
  onCheckUpdate,
  onInstallUpdate,
}: Props) {
  // Les parametres ne se referment que par leur croix. Un clic maladroit a
  // cote, ou une touche Echap pressee par reflexe, ne doivent pas faire perdre
  // ce que l'on etait en train de regler.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <div className="settings__veil">
      <div className="settings" role="dialog" aria-modal="true" aria-label="Parametres">
        <header className="settings__head">
          <h1>Parametres</h1>
          <button type="button" className="settings__close" onClick={onClose} title="Fermer">
            ×
          </button>
        </header>

        <div className="settings__body">
          <section className="settings__section">
            <h2>Taille de l'ecriture</h2>
            <p className="settings__hint">
              N'agit que sur la zone d'edition des notes, pas sur le reste de
              l'application.
            </p>
            <div className="settings__choices">
              {AGRANDISSEMENTS.map((choix) => (
                <button
                  key={choix.valeur}
                  type="button"
                  className={settings.zoom === choix.valeur ? "is-active" : ""}
                  onClick={() => onChange({ zoom: choix.valeur })}
                >
                  <span className="settings__choice-name">{choix.nom}</span>
                  <span className="settings__choice-detail">{choix.detail}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="settings__section">
            <h2>Bande de gauche</h2>
            <p className="settings__hint">
              Sa largeur pendant l'ecriture. Elle se regle aussi en tirant son bord.
            </p>
            <div className="settings__slider">
              <input
                type="range"
                min={140}
                max={520}
                step={10}
                value={settings.rail_width}
                onChange={(event) => onChange({ rail_width: Number(event.target.value) })}
              />
              <span className="settings__value">{settings.rail_width} px</span>
            </div>
          </section>

          <section className="settings__section">
            <h2>Vault</h2>
            <p className="settings__hint">Le dossier racine qui contient tout.</p>
            <div className="settings__vault">
              <span className="settings__path">{vault?.path ?? "Aucun Vault ouvert"}</span>
              <button
                type="button"
                className="settings__action"
                onClick={() => {
                  onClose();
                  onChangeVault();
                }}
              >
                Changer de Vault…
              </button>
            </div>
          </section>

          <section className="settings__section">
            <h2>A propos</h2>
            <p className="settings__hint">
              Mentaliis est un espace ou l'on entre : chaque dossier y est une porte,
              chaque note un objet que l'on place librement. Tout vit dans un Vault,
              sur cette machine, et rien n'en sort.
            </p>
            <div className="apropos">
              <div className="apropos__ligne">
                <span className="apropos__cle">Edition</span>
                <span className="apropos__valeur">Mentaliis {__APP_VERSION__}</span>
              </div>
              <div className="apropos__ligne">
                <span className="apropos__cle">Createur</span>
                <span className="apropos__valeur">AJTVIRTUAL - AMILCAR JOAO</span>
              </div>
              <p className="apropos__droit">
                &copy; {__BUILD_YEAR__} AJTVIRTUAL - AMILCAR JOAO Tous droits réservés.
              </p>
            </div>
          </section>

          <section className="settings__section">
            <h2>Version</h2>
            <p className="settings__hint">
              Mentaliis va chercher lui-meme ses mises a jour au demarrage.
            </p>
            <div className="settings__vault">
              <span className="settings__path">{etatDeMaj(updateState)}</span>
              {/* Quand une version attend, on doit pouvoir l'installer d'ici :
                  aller rechercher le bandeau derriere le panneau serait absurde. */}
              {updateState.etat === "disponible" ? (
                <button
                  type="button"
                  className="settings__action settings__action--maj"
                  onClick={onInstallUpdate}
                >
                  Installer et relancer
                </button>
              ) : (
                <button
                  type="button"
                  className="settings__action"
                  onClick={onCheckUpdate}
                  disabled={
                    updateState.etat === "recherche" ||
                    updateState.etat === "telechargement" ||
                    updateState.etat === "installation"
                  }
                >
                  Rechercher maintenant
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}


/** Ce que le panneau dit de la recherche de mise a jour, en clair. */
function etatDeMaj(state: UpdateState): string {
  switch (state.etat) {
    case "recherche":
      return "Recherche en cours…";
    case "a-jour":
      return "Mentaliis est a jour.";
    case "disponible":
      return `Version ${state.version} disponible.`;
    case "telechargement":
      return `Telechargement… ${Math.round(state.progres * 100)} %`;
    case "installation":
      return "Installation…";
    case "echec":
      return "Recherche impossible pour le moment.";
    case "muet":
      return "La recherche du demarrage n'a pas abouti.";
    default:
      return "Aucune recherche depuis l'ouverture.";
  }
}
