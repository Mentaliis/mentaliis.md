/** Barre du haut : le chemin parcouru dans le Vault, et la recherche. */

import type { VaultInfo } from "../lib/types";

interface Props {
  vault: VaultInfo;
  path: string;
  onNavigate: (path: string) => void;
  onSearch: () => void;
  onChangeVault: () => void;
}

export function Topbar({ vault, path, onNavigate, onSearch, onChangeVault }: Props) {
  const segments = path ? path.split("/") : [];

  return (
    <header className="topbar">
      <nav className="breadcrumb">
        <button type="button" className="breadcrumb__root" onClick={() => onNavigate("")}>
          {vault.name}
        </button>
        {segments.map((segment, index) => (
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
      </nav>

      <div className="topbar__actions">
        <button type="button" onClick={onSearch} title="Rechercher (Ctrl+K)">
          Rechercher
        </button>
        <button type="button" onClick={onChangeVault} title="Changer de Vault">
          Vault
        </button>
      </div>
    </header>
  );
}
