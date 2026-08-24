/** Recherche plein texte dans tout le Vault. */

import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { NoteSummary } from "../lib/types";

interface Props {
  onPick: (note: NoteSummary) => void;
  onClose: () => void;
}

export function SearchPalette({ onPick, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NoteSummary[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  // Recherche differee, pour ne pas interroger le moteur a chaque frappe.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      api
        .search(query)
        .then((found) => {
          setResults(found);
          setHighlighted(0);
        })
        .catch(() => setResults([]));
    }, 160);
    return () => window.clearTimeout(timer);
  }, [query]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") onClose();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((index) => Math.min(index + 1, results.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((index) => Math.max(index - 1, 0));
    }
    if (event.key === "Enter" && results[highlighted]) {
      onPick(results[highlighted]);
    }
  };

  return (
    <div className="overlay" onPointerDown={onClose}>
      <div className="palette" onPointerDown={(event) => event.stopPropagation()}>
        <input
          ref={input}
          className="palette__input"
          placeholder="Chercher dans tout le Vault…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <ul className="palette__results">
          {results.map((note, index) => (
            <li key={note.id}>
              <button
                type="button"
                className={index === highlighted ? "is-highlighted" : ""}
                onPointerEnter={() => setHighlighted(index)}
                onClick={() => onPick(note)}
              >
                <span className="palette__title">{note.title}</span>
                <span className="palette__path">{note.id}</span>
              </button>
            </li>
          ))}
          {query.trim() && results.length === 0 && (
            <li className="palette__empty">Aucune note trouvee.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
