/**
 * Le menu du « + » : tout ce qu'on peut poser dans une note.
 *
 * Chaque entree porte son icone et le raccourci markdown qui la declenche, pour
 * qu'on finisse par s'en passer. Choisir un media ouvre la reserve, filtree sur
 * la famille demandee.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import type { MediaFile } from "../lib/types";
import { ICONS } from "./icons";
import { INSERT_GROUPS, SYMBOL_GROUPS, type Insertion } from "./insertions";

type Panel = "blocs" | "symboles";

interface Props {
  onInsert: (insertion: Insertion) => void;
  /** Insere un symbole mathematique dans une formule. */
  onSymbol: (latex: string) => void;
  /** Insere un media du Vault, par son chemin. */
  onMedia: (path: string) => void;
  onUpload: (file: File) => Promise<void>;
  onClose: () => void;
}

export function InsertMenu({ onInsert, onSymbol, onMedia, onUpload, onClose }: Props) {
  const [panel, setPanel] = useState<Panel>("blocs");
  /** Famille de medias en cours de choix, quand on vient de cliquer « Image »… */
  const [famille, setFamille] = useState<string | null>(null);
  const [reserve, setReserve] = useState<MediaFile[] | null>(null);
  const [filter, setFilter] = useState("");
  const element = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  /**
   * Vers le haut, sauf si l'ecran le coupe.
   *
   * La poignee « + » suit la ligne survolee : elle se trouve donc souvent en
   * bas de l'ecran, ou un menu qui descend serait tronque. On l'ouvre vers le
   * haut par defaut, et on ne bascule que s'il n'y a pas la place — de sorte
   * qu'on voit toujours toutes les propositions.
   */
  const [versLeHaut, setVersLeHaut] = useState(true);

  useLayoutEffect(() => {
    const boite = element.current;
    if (!boite) return;
    const cadre = boite.getBoundingClientRect();
    const ancre = boite.parentElement?.getBoundingClientRect();
    if (!ancre) return;
    const marge = 12;
    const placeAuDessus = ancre.top - marge;
    const placeEnDessous = window.innerHeight - ancre.bottom - marge;
    // On garde le haut tant qu'il y tient ; sinon on prend le cote le plus large.
    setVersLeHaut(cadre.height <= placeAuDessus || placeAuDessus >= placeEnDessous);
  }, [panel, famille, reserve, filter]);

  useEffect(() => {
    const dismiss = (event: MouseEvent) => {
      if (!element.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (!famille || reserve) return;
    api
      .media()
      .then((media) => setReserve(media.files))
      .catch(() => setReserve([]));
  }, [famille, reserve]);

  const proposes = useMemo(() => {
    const cherche = filter.trim().toLowerCase();
    return (reserve ?? [])
      .filter((file) => file.kind === famille)
      .filter((file) => file.path.toLowerCase().includes(cherche));
  }, [famille, filter, reserve]);

  // --- Choix d'un media ---

  if (famille) {
    return (
      <div ref={element} className={`insert insert--media${versLeHaut ? " insert--haut" : ""}`}>
        <header className="insert__head">
          <button type="button" className="insert__back" onClick={() => setFamille(null)}>
            ‹ Retour
          </button>
          <span>{famille}</span>
        </header>

        <input
          className="insert__filter"
          placeholder="Filtrer…"
          value={filter}
          autoFocus
          onChange={(event) => setFilter(event.target.value)}
        />

        <div className="insert__body">
          {reserve === null && <p className="insert__empty">Lecture de la reserve…</p>}
          {reserve !== null && proposes.length === 0 && (
            <p className="insert__empty">
              Rien de ce type dans <code>.MEDIAS</code>. Deposez-y vos fichiers.
            </p>
          )}
          <div className="insert__files">
            {proposes.map((file) => (
              <button
                key={file.path}
                type="button"
                className="insert__file"
                title={file.path}
                onClick={() => onMedia(file.path)}
              >
                {file.kind === "image" ? (
                  <img src={api.fileUrl(file.path)} alt="" draggable={false} />
                ) : (
                  <span className="insert__file-icon">{ICONS[file.kind]}</span>
                )}
                <span>{file.path.split("/").pop()}</span>
              </button>
            ))}
          </div>
        </div>

        <footer className="insert__foot">
          <button type="button" onClick={() => picker.current?.click()}>
            Importer un fichier…
          </button>
          <input
            ref={picker}
            type="file"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) await onUpload(file);
            }}
          />
        </footer>
      </div>
    );
  }

  // --- Catalogue ---

  return (
    <div ref={element} className={`insert${versLeHaut ? " insert--haut" : ""}`}>
      <nav className="insert__tabs">
        {(["blocs", "symboles"] as Panel[]).map((name) => (
          <button
            key={name}
            type="button"
            className={panel === name ? "is-active" : ""}
            onClick={() => setPanel(name)}
          >
            {name === "blocs" ? "Blocs" : "Symboles"}
          </button>
        ))}
      </nav>

      <div className="insert__body">
        {panel === "blocs" &&
          INSERT_GROUPS.map((group) => (
            <div key={group.name} className="insert__group">
              <h4>{group.name}</h4>
              <div className="insert__list">
                {group.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="insert__item"
                    onClick={() => (item.media ? setFamille(item.media) : onInsert(item))}
                  >
                    <span className="insert__item-icon">{ICONS[item.icon]}</span>
                    <span className="insert__item-label">{item.label}</span>
                    {item.hint && <span className="insert__item-hint">{item.hint}</span>}
                    {item.media && <span className="insert__item-hint">›</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}

        {panel === "symboles" &&
          SYMBOL_GROUPS.map((group) => (
            <div key={group.name} className="insert__group">
              <h4>{group.name}</h4>
              <div className="insert__symbols">
                {group.symbols.map((symbol) => (
                  <button
                    key={symbol.latex}
                    type="button"
                    title={`${symbol.name} · ${symbol.latex}`}
                    onClick={() => onSymbol(symbol.latex)}
                  >
                    {symbol.glyph}
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
