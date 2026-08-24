/** La page des reglages. */

import { useEffect } from "react";
import type { Settings, VaultInfo } from "../lib/types";

const AGRANDISSEMENTS: { valeur: 1 | 2 | 3; nom: string; detail: string }[] = [
  { valeur: 1, nom: "1×", detail: "Taille normale" },
  { valeur: 2, nom: "2×", detail: "Deux fois plus grand" },
  { valeur: 3, nom: "3×", detail: "Trois fois plus grand" },
];

interface Props {
  settings: Settings;
  vault: VaultInfo | null;
  onChange: (change: Partial<Settings>) => void;
  onChangeVault: () => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, vault, onChange, onChangeVault, onClose }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      className="settings__veil"
      onPointerDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="settings" role="dialog" aria-modal="true" aria-label="Parametres">
        <header className="settings__head">
          <h1>Parametres</h1>
          <button type="button" className="settings__close" onClick={onClose} title="Fermer">
            ×
          </button>
        </header>

        <div className="settings__body">
          <section className="settings__section">
            <h2>Agrandissement</h2>
            <p className="settings__hint">
              Met toute l'interface a l'echelle, texte et elements compris.
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
        </div>
      </div>
    </div>
  );
}
