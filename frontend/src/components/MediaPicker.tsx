/**
 * Choisir l'image de vision d'une porte, ou l'icone qui la represente.
 *
 * Tout vient de la reserve du Vault, dont le nom est impose : `.MEDIAS` pour les
 * images, `.MEDIAS/.SVG` pour les icones. L'application ne cree jamais ces
 * dossiers — ils sont a l'utilisateur, qui les remplit comme il l'entend.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Door, MediaLibrary } from "../lib/types";

/** Ce que la fenetre propose : une vision, ou une apparence. */
export type MediaKind = "vision" | "icone";

interface Props {
  kind: MediaKind;
  door: Door;
  onPickVision: (path: string | null) => void;
  onPickIcon: (icon: string) => void;
  onClose: () => void;
}

const FORMATS = "svg, png, webp";

export function MediaPicker({ kind, door, onPickVision, onPickIcon, onClose }: Props) {
  const [media, setMedia] = useState<MediaLibrary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .media()
      .then(setMedia)
      .catch((problem: Error) => setError(problem.message));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const vision = kind === "vision";
  const dossier = vision ? media?.folder : media?.icons_folder;
  const present = vision ? media?.exists : media?.icons_exist;
  const items = (vision ? media?.images : media?.icons) ?? [];

  return (
    <div
      className="media__veil"
      onPointerDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="media" role="dialog" aria-modal="true" aria-label={vision ? "Image de vision" : "Icone de la porte"}>
        <header className="media__head">
          <div>
            <h2>{vision ? "Image de vision" : "Icone de la porte"}</h2>
            <p className="media__hint">
              Pour « {door.name} ». {vision ? "Les images" : `Les icones (${FORMATS})`} sont lues
              dans <code>{dossier}</code>.
            </p>
          </div>
          <button type="button" className="media__close" onClick={onClose} title="Fermer">
            ×
          </button>
        </header>

        <div className="media__body">
          {error && <p className="media__error">{error}</p>}
          {media === null && !error && <p className="media__empty">Lecture du Vault…</p>}

          {/* Les deux apparences fournies sont toujours proposees : elles ne
              dependent d'aucun dossier. */}
          {media && !vision && (
            <div className="media__grid media__grid--icons">
              <BuiltIn
                label="Porte"
                active={door.icon === "porte"}
                onPick={() => onPickIcon("porte")}
              >
                <span className="media__door" />
              </BuiltIn>
              <BuiltIn
                label="Cerveau"
                active={door.icon === "cerveau"}
                onPick={() => onPickIcon("cerveau")}
              >
                <span className="media__brain">🧠</span>
              </BuiltIn>

              {items.map((path) => (
                <button
                  key={path}
                  type="button"
                  className={`media__item${door.icon === path ? " is-current" : ""}`}
                  title={path}
                  onClick={() => onPickIcon(path)}
                >
                  <img src={api.fileUrl(path)} alt="" draggable={false} />
                  <span>{path.split("/").pop()}</span>
                </button>
              ))}
            </div>
          )}

          {media && !present && (
            <p className="media__empty">
              Le dossier <code>{dossier}</code> n'existe pas encore. Creez-le avec ce nom exact,
              puis rouvrez cette fenetre.
            </p>
          )}

          {media && present && items.length === 0 && (
            <p className="media__empty">
              Aucun fichier dans <code>{dossier}</code>. Deposez-y vos
              {vision ? " images" : ` icones (${FORMATS})`}, puis rouvrez cette fenetre.
            </p>
          )}

          {media && present && vision && items.length > 0 && (
            <div className="media__grid">
              {items.map((path) => (
                <button
                  key={path}
                  type="button"
                  className={`media__item${door.cover === path ? " is-current" : ""}`}
                  title={path}
                  onClick={() => onPickVision(path)}
                >
                  <img src={api.fileUrl(path)} alt="" draggable={false} />
                  <span>{path.split("/").pop()}</span>
                </button>
              ))}
            </div>
          )}

        </div>

        <footer className="media__foot">
          <button type="button" className="media__link" onClick={load}>
            Relire le dossier
          </button>
          {vision && door.cover && (
            <button
              type="button"
              className="media__link is-danger"
              onClick={() => onPickVision(null)}
            >
              Retirer l'image
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

/** Une des deux apparences fournies avec le logiciel. */
function BuiltIn({
  label,
  active,
  onPick,
  children,
}: {
  label: string;
  active: boolean;
  onPick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`media__item media__item--builtin${active ? " is-current" : ""}`}
      onClick={onPick}
    >
      <span className="media__builtin">{children}</span>
      <span>{label}</span>
    </button>
  );
}
