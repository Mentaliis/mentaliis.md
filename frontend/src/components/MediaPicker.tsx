/**
 * Choisir l'image de vision d'une porte.
 *
 * Elle vient obligatoirement du Vault, et d'un dossier designe comme responsable
 * des medias. Tant qu'aucun ne l'est, on commence par en choisir un parmi ceux
 * qui existent deja : l'application n'en cree jamais a la place de l'utilisateur.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { MediaLibrary } from "../lib/types";

interface Props {
  /** Nom de la porte, rappele dans le titre. */
  doorName: string;
  /** Image actuellement posee, pour la marquer comme choisie. */
  current: string | null;
  onPick: (path: string | null) => void;
  onClose: () => void;
}

export function MediaPicker({ doorName, current, onPick, onClose }: Props) {
  const [media, setMedia] = useState<MediaLibrary | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Vrai quand on veut changer de dossier alors qu'il en existe deja un. */
  const [choosing, setChoosing] = useState(false);

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

  const designer = async (folder: string) => {
    try {
      setMedia(await api.setMediaFolder(folder));
      setChoosing(false);
      setError(null);
    } catch (problem) {
      setError((problem as Error).message);
    }
  };

  const enChoix = media !== null && (choosing || !media.folder);

  return (
    <div
      className="media__veil"
      onPointerDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="media" role="dialog" aria-modal="true" aria-label="Image de vision">
        <header className="media__head">
          <div>
            <h2>Image de vision</h2>
            <p className="media__hint">
              {enChoix
                ? "Choisissez le dossier du Vault qui contient vos medias."
                : `Pour la porte « ${doorName} ». Les images viennent de ${media?.folder}.`}
            </p>
          </div>
          <button type="button" className="media__close" onClick={onClose} title="Fermer">
            ×
          </button>
        </header>

        <div className="media__body">
          {error && <p className="media__error">{error}</p>}

          {media === null && !error && <p className="media__empty">Lecture du Vault…</p>}

          {enChoix && media && (
            <>
              {media.folders.length === 0 ? (
                <p className="media__empty">
                  Ce Vault ne contient encore aucun dossier. Creez-en un, puis revenez.
                </p>
              ) : (
                <ul className="media__folders">
                  {media.folders.map((folder) => (
                    <li key={folder}>
                      <button type="button" onClick={() => void designer(folder)}>
                        {folder}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {!enChoix && media?.folder && (
            <>
              {media.images.length === 0 ? (
                <p className="media__empty">
                  Aucune image dans {media.folder}. Deposez-y vos fichiers, puis rouvrez cette
                  fenetre.
                </p>
              ) : (
                <div className="media__grid">
                  {media.images.map((path) => (
                    <button
                      key={path}
                      type="button"
                      className={`media__item${path === current ? " is-current" : ""}`}
                      title={path}
                      onClick={() => onPick(path)}
                    >
                      <img src={api.fileUrl(path)} alt="" draggable={false} />
                      <span>{path.split("/").pop()}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <footer className="media__foot">
          {!enChoix && media?.folder && (
            <button type="button" className="media__link" onClick={() => setChoosing(true)}>
              Changer de dossier…
            </button>
          )}
          {current && !enChoix && (
            <button type="button" className="media__link is-danger" onClick={() => onPick(null)}>
              Retirer l'image
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
