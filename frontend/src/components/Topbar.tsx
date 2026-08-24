/** Barre du haut : le chemin parcouru dans le Vault, et la recherche. */

import type { VaultInfo } from "../lib/types";

export type View = "scene" | "constellation";

interface Props {
  vault: VaultInfo;
  path: string;
  view: View;
  /** Titre de la note ouverte, quand on est en train d'ecrire. */
  editingTitle?: string;
  onNavigate: (path: string) => void;
  onChangeView: (view: View) => void;
  onSearch: () => void;
  onOpenSettings: () => void;
}

export function Topbar({
  vault,
  path,
  view,
  editingTitle,
  onNavigate,
  onChangeView,
  onSearch,
  onOpenSettings,
}: Props) {
  const segments = path ? path.split("/") : [];

  return (
    <header className="topbar">
      <nav className="breadcrumb">
        <button type="button" className="breadcrumb__root" onClick={() => onNavigate("")}>
          {vault.name}
        </button>
        {(view === "scene" || editingTitle) &&
          segments.map((segment, index) => (
            <span key={segment + index} className="breadcrumb__step">
              <span className="breadcrumb__sep">›</span>
              <button
                type="button"
                onClick={() => onNavigate(segments.slice(0, index + 1).join("/"))}
              >
                {segment}
              </button>
            </span>
          ))}
        {editingTitle && (
          <span className="breadcrumb__step">
            <span className="breadcrumb__sep">›</span>
            <button type="button" disabled>
              {editingTitle}
            </button>
          </span>
        )}
        {view === "constellation" && !editingTitle && (
          <span className="breadcrumb__step">
            <span className="breadcrumb__sep">›</span>
            <button type="button" disabled>
              tout le Vault
            </button>
          </span>
        )}
      </nav>

      <div className="topbar__actions">
        <div className="topbar__views">
          <button
            type="button"
            className={view === "scene" ? "is-active" : ""}
            onClick={() => onChangeView("scene")}
            title="Revenir dans les portes"
          >
            Portes
          </button>
          <button
            type="button"
            className={view === "constellation" ? "is-active" : ""}
            onClick={() => onChangeView("constellation")}
            title="Voir tout le Vault d'un coup (Ctrl+G)"
          >
            Constellation
          </button>
        </div>
        <button type="button" onClick={onSearch} title="Rechercher (Ctrl+K)">
          Rechercher
        </button>
        <button
          type="button"
          className="topbar__gear"
          onClick={onOpenSettings}
          title="Parametres (Ctrl+,)"
          aria-label="Parametres"
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
