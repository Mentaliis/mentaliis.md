/** Le menu du bouton « + » : tout ce qu'on peut glisser dans une note. */

import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { INSERT_GROUPS, SYMBOL_GROUPS, type Insertion } from "./insertions";

type Panel = "blocs" | "symboles" | "images";

interface Props {
  onInsert: (insertion: Insertion) => void;
  /** Insere un symbole mathematique dans une formule. */
  onSymbol: (latex: string) => void;
  onImage: (path: string) => void;
  onUpload: (file: File) => Promise<void>;
  onClose: () => void;
}

export function InsertMenu({ onInsert, onSymbol, onImage, onUpload, onClose }: Props) {
  const [panel, setPanel] = useState<Panel>("blocs");
  const [assets, setAssets] = useState<string[] | null>(null);
  const [filter, setFilter] = useState("");
  const element = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);

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
    if (panel !== "images" || assets) return;
    api
      .assets()
      .then(setAssets)
      .catch(() => setAssets([]));
  }, [assets, panel]);

  const shown = (assets ?? []).filter((path) =>
    path.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <div ref={element} className="insert">
      <nav className="insert__tabs">
        {(["blocs", "symboles", "images"] as Panel[]).map((name) => (
          <button
            key={name}
            type="button"
            className={panel === name ? "is-active" : ""}
            onClick={() => setPanel(name)}
          >
            {name}
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
                    onClick={() => {
                      onInsert(item);
                      onClose();
                    }}
                  >
                    {item.label}
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

        {panel === "images" && (
          <div className="insert__group">
            <div className="insert__upload">
              <button type="button" onClick={() => picker.current?.click()}>
                Ajouter une image…
              </button>
              <input
                ref={picker}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={async (event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  for (const file of files) await onUpload(file);
                  setAssets(null); // la liste doit etre refaite
                }}
              />
            </div>

            {assets === null ? (
              <p className="insert__empty">Lecture du Vault…</p>
            ) : assets.length === 0 ? (
              <p className="insert__empty">Aucune image dans le Vault.</p>
            ) : (
              <>
                <input
                  className="insert__filter"
                  placeholder="Filtrer…"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                />
                <div className="insert__grid">
                  {shown.map((path) => (
                    <button
                      key={path}
                      type="button"
                      title={path}
                      onClick={() => {
                        onImage(path);
                        onClose();
                      }}
                    >
                      <img src={api.assetUrl(path)} alt="" loading="lazy" />
                      <span>{path.split("/").pop()}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
