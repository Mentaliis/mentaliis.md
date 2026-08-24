/** Ecran d'accueil : choisir le Vault, le dossier racine qui contient tout. */

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { VaultInfo } from "../lib/types";

interface Props {
  onOpened: (vault: VaultInfo) => void;
  onCancel?: () => void;
}

/** True quand l'application tourne dans sa fenetre native, false dans un navigateur. */
const inTauri = "__TAURI_INTERNALS__" in window;

export function VaultPicker({ onOpened, onCancel }: Props) {
  const [path, setPath] = useState("");
  const [previous, setPrevious] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .lastVault()
      .then((result) => setPrevious(result.path))
      .catch(() => undefined);
  }, []);

  const open = async (target: string) => {
    if (!target.trim()) return;
    setBusy(true);
    setError(null);
    try {
      onOpened(await api.openVault(target.trim()));
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const browse = async () => {
    // Le selecteur de dossier natif n'existe que dans la fenetre Tauri.
    const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
    const chosen = await openDialog({ directory: true, title: "Choisir un Vault" });
    if (typeof chosen === "string") await open(chosen);
  };

  return (
    <div className="picker">
      <div className="picker__panel">
        <h1 className="picker__brand">Mentaliis</h1>
        <p className="picker__lead">
          Un Vault est le dossier racine qui contient tout : vos portes, vos notes, vos images.
        </p>

        {previous && (
          <button type="button" className="picker__recent" onClick={() => open(previous)}>
            Rouvrir <strong>{previous.split(/[\\/]/).pop()}</strong>
            <span>{previous}</span>
          </button>
        )}

        {inTauri ? (
          <button type="button" className="picker__primary" onClick={browse} disabled={busy}>
            Choisir un dossier…
          </button>
        ) : (
          <form
            className="picker__form"
            onSubmit={(event) => {
              event.preventDefault();
              void open(path);
            }}
          >
            <input
              className="picker__input"
              placeholder="C:\Users\moi\Mon Vault"
              value={path}
              onChange={(event) => setPath(event.target.value)}
            />
            <button type="submit" className="picker__primary" disabled={busy}>
              Ouvrir
            </button>
          </form>
        )}

        {error && <p className="picker__error">{error}</p>}
        {onCancel && (
          <button type="button" className="picker__cancel" onClick={onCancel}>
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
