/**
 * Choisir le langage d'un bloc de code.
 *
 * Une liste filtrable, comme celle des dossiers : on tape trois lettres, on
 * choisit. Le nom retenu est ecrit apres les trois accents graves, dans le
 * fichier markdown — c'est la « chaine d'info » de CommonMark, comprise par
 * tous les autres editeurs. Rien de propre a Mentaliis n'est invente.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { langagesConnus } from "./coloration";

interface Props {
  /** Le langage annonce par le bloc, ou null s'il n'en annonce aucun. */
  courant: string | null;
  /** Ou poser la liste, en pixels de la fenetre. */
  ancre: { x: number; y: number };
  onChoisir: (langage: string | null) => void;
  onClose: () => void;
}

export function LanguagePicker({ courant, ancre, onChoisir, onClose }: Props) {
  const [filtre, setFiltre] = useState("");
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    champ.current?.focus();
    const auClavier = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", auClavier, true);
    return () => window.removeEventListener("keydown", auClavier, true);
  }, [onClose]);

  const proposes = useMemo(() => {
    const cherche = filtre.trim().toLowerCase();
    const tous = langagesConnus.map((langage) => langage.name);
    if (!cherche) return tous;
    // On cherche aussi dans les autres noms d'un langage : « js » trouve
    // JavaScript, « py » trouve Python.
    return langagesConnus
      .filter(
        (langage) =>
          langage.name.toLowerCase().includes(cherche) ||
          langage.alias.some((autre) => autre.includes(cherche)),
      )
      .map((langage) => langage.name);
  }, [filtre]);

  return (
    <div className="langues__voile" onPointerDown={onClose}>
      <div
        className="langues"
        style={{ left: ancre.x, top: ancre.y }}
        role="dialog"
        aria-label="Langage du bloc de code"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <input
          ref={champ}
          className="langues__filtre"
          placeholder="Rechercher un langage…"
          value={filtre}
          onChange={(event) => setFiltre(event.target.value)}
        />
        <div className="langues__liste">
          <button
            type="button"
            className={`langues__choix${courant === null ? " is-courant" : ""}`}
            onClick={() => onChoisir(null)}
          >
            <span>Texte brut</span>
            {courant === null && <span className="langues__coche">✓</span>}
          </button>
          {proposes.map((nom) => (
            <button
              key={nom}
              type="button"
              className={`langues__choix${nom === courant ? " is-courant" : ""}`}
              onClick={() => onChoisir(nom)}
            >
              <span>{nom}</span>
              {nom === courant && <span className="langues__coche">✓</span>}
            </button>
          ))}
          {proposes.length === 0 && <p className="langues__vide">Aucun langage ne correspond.</p>}
        </div>
      </div>
    </div>
  );
}
