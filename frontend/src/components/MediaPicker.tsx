/**
 * Choisir un media du Vault : la vision d'une porte, son icone, ou une image a
 * accrocher a une note.
 *
 * Tout vient de la reserve, dont le nom est impose : `.MEDIAS` pour les images,
 * `.MEDIAS/.SVG` pour les icones. L'application ne cree jamais ces dossiers —
 * ils sont a l'utilisateur, qui les remplit comme il l'entend.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { MediaLibrary } from "../lib/types";

/** Ce que la fenetre sert a choisir. */
export type MediaKind = "vision" | "icone" | "note" | "scene";

interface Props {
  kind: MediaKind;
  /** Nom de l'element concerne, rappele dans l'en-tete. */
  subject: string;
  /** Choix en vigueur, pour le marquer. */
  current: string | null;
  /** Recoit le chemin choisi, une apparence fournie, ou null pour retirer. */
  onPick: (value: string | null) => void;
  onClose: () => void;
}

const FORMATS = "svg, png, webp";

const TITRES: Record<MediaKind, string> = {
  vision: "Image de vision",
  icone: "Icone de la porte",
  note: "Image de la note",
  scene: "Poser une image",
};

export function MediaPicker({ kind, subject, current, onPick, onClose }: Props) {
  const [media, setMedia] = useState<MediaLibrary | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Dossier ouvert dans la reserve, relatif a sa racine. */
  const [chemin, setChemin] = useState("");
  const [cherche, setCherche] = useState("");

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

  const icones = kind === "icone";
  const racine = (icones ? media?.icons_folder : media?.folder) ?? "";
  const present = icones ? media?.icons_exist : media?.exists;
  const tout = (icones ? media?.icons : media?.images) ?? [];

  // Le dossier ouvert, et ce qu'il contient directement.
  const base = chemin ? `${racine}/${chemin}/` : `${racine}/`;
  const dedans = tout.filter((path) => path.startsWith(base));
  const filtre = cherche.trim().toLowerCase();

  // En cherchant, on regarde tout le sous-arbre ; sinon, seulement ce niveau.
  const items = filtre
    ? dedans.filter((path) => path.toLowerCase().includes(filtre))
    : dedans.filter((path) => !path.slice(base.length).includes("/"));

  const sousDossiers = filtre
    ? []
    : [
        ...new Set(
          dedans
            .map((path) => path.slice(base.length))
            .filter((reste) => reste.includes("/"))
            .map((reste) => reste.split("/")[0]),
        ),
      ].sort();

  const miettes = chemin ? chemin.split("/") : [];

  return (
    <div
      className="media__veil"
      onPointerDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="media" role="dialog" aria-modal="true" aria-label={TITRES[kind]}>
        <header className="media__head">
          <div>
            <h2>{TITRES[kind]}</h2>
            <p className="media__hint">
              Pour « {subject} ». {icones ? `Les icones (${FORMATS})` : "Les images"} sont lues
              dans <code>{racine}</code>, sous-dossiers compris.
            </p>
          </div>
          <button type="button" className="media__close" onClick={onClose} title="Fermer">
            ×
          </button>
        </header>

        {/* Le chemin ouvert, pour remonter d'un clic. */}
        {media && present && (
          <div className="media__bar">
            <nav className="media__path">
              <button type="button" onClick={() => setChemin("")}>
                {racine}
              </button>
              {miettes.map((nom, index) => (
                <span key={`${nom}-${index}`}>
                  <span className="media__sep">›</span>
                  <button
                    type="button"
                    onClick={() => setChemin(miettes.slice(0, index + 1).join("/"))}
                  >
                    {nom}
                  </button>
                </span>
              ))}
            </nav>
            <input
              className="media__search"
              placeholder="Chercher partout…"
              value={cherche}
              onChange={(event) => setCherche(event.target.value)}
            />
          </div>
        )}

        <div className="media__body">
          {error && <p className="media__error">{error}</p>}
          {media === null && !error && <p className="media__empty">Lecture du Vault…</p>}

          {/* Les deux apparences fournies sont toujours proposees : elles ne
              dependent d'aucun dossier. */}
          {media && icones && (
            <div className="media__grid media__grid--icons">
              <BuiltIn label="Porte" active={current === "porte"} onPick={() => onPick("porte")}>
                <span className="media__door" />
              </BuiltIn>
              <BuiltIn
                label="Cerveau"
                active={current === "cerveau"}
                onPick={() => onPick("cerveau")}
              >
                <span className="media__brain">🧠</span>
              </BuiltIn>
              {items.map((path) => (
                <Vignette key={path} path={path} active={current === path} onPick={onPick} />
              ))}
            </div>
          )}

          {media && !present && (
            <p className="media__empty">
              Le dossier <code>{racine}</code> n'existe pas encore. Creez-le avec ce nom exact,
              puis rouvrez cette fenetre.
            </p>
          )}

          {media && present && sousDossiers.length > 0 && (
            <ul className="media__folders">
              {sousDossiers.map((nom) => (
                <li key={nom}>
                  <button
                    type="button"
                    onClick={() => setChemin(chemin ? `${chemin}/${nom}` : nom)}
                  >
                    <span className="media__folder-icon" aria-hidden="true">
                      ▸
                    </span>
                    {nom}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {media && present && items.length === 0 && sousDossiers.length === 0 && (
            <p className="media__empty">
              {cherche
                ? "Rien ne correspond a cette recherche."
                : `Rien ici. Deposez vos ${icones ? "icones" : "images"} dans ce dossier.`}
            </p>
          )}

          {media && present && !icones && items.length > 0 && (
            <div className="media__grid">
              {items.map((path) => (
                <Vignette key={path} path={path} active={current === path} onPick={onPick} />
              ))}
            </div>
          )}
        </div>

        <footer className="media__foot">
          <button type="button" className="media__link" onClick={load}>
            Relire le dossier
          </button>
          {kind === "vision" && current && (
            <button type="button" className="media__link is-danger" onClick={() => onPick(null)}>
              Retirer l'image
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function Vignette({
  path,
  active,
  onPick,
}: {
  path: string;
  active: boolean;
  onPick: (value: string) => void;
}) {
  return (
    <button
      type="button"
      className={`media__item${active ? " is-current" : ""}`}
      title={path}
      onClick={() => onPick(path)}
    >
      <img src={api.fileUrl(path)} alt="" draggable={false} />
      <span>{path.split("/").pop()}</span>
    </button>
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
