/**
 * Choisir ou ranger une note ou une porte.
 *
 * On pointe le dossier d'arrivee dans l'arborescence du Vault, et c'est tout —
 * jamais besoin d'aller ouvrir l'explorateur de fichiers a cote. Le dossier ou
 * l'element se trouve deja est marque, et ceux ou il ne peut pas aller — un
 * dossier dans lui-meme, ou dans ce qu'il contient — sont ecartes plutot que
 * d'echouer une fois choisis.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import type { Folder } from "../lib/types";
import { IconeDossier } from "./Icones";

interface Props {
  /** Ce que l'on range : son identifiant, et son nom pour le dire. */
  id: string;
  nom: string;
  /** Le dossier ou il se trouve en ce moment. */
  parent: string;
  onRange: (nouveauId: string) => void;
  onClose: () => void;
}

export function DossierPicker({ id, nom, parent, onRange, onClose }: Props) {
  const [dossiers, setDossiers] = useState<Folder[] | null>(null);
  const [filtre, setFiltre] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [encours, setEncours] = useState(false);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .folders()
      .then(setDossiers)
      .catch((probleme) => setErreur((probleme as Error).message));
  }, []);

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

  /** Un dossier ne peut pas entrer en lui-meme, ni dans ce qu'il contient. */
  const proposables = useMemo(() => {
    if (!dossiers) return [];
    const interdit = (cible: string) => cible === id || cible.startsWith(`${id}/`);
    const cherche = filtre.trim().toLowerCase();
    return dossiers.filter((dossier) => {
      if (interdit(dossier.id)) return false;
      if (!cherche) return true;
      // On cherche dans le chemin entier : « proj/plan » retrouve son dossier.
      return (dossier.id || dossier.name).toLowerCase().includes(cherche);
    });
  }, [dossiers, filtre, id]);

  const ranger = async (destination: string) => {
    if (destination === parent || encours) return;
    setEncours(true);
    setErreur(null);
    try {
      const { id: nouveau } = await api.moveTo(id, destination);
      onRange(nouveau);
    } catch (probleme) {
      setErreur((probleme as Error).message);
      setEncours(false);
    }
  };

  return (
    <div
      className="ranger__voile"
      onPointerDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="ranger" role="dialog" aria-modal="true" aria-label={`Ranger ${nom}`}>
        <header className="ranger__tete">
          <div>
            <h1>Ranger « {nom} »</h1>
            <p className="ranger__mot">Choisissez le dossier d'arrivee.</p>
          </div>
          <button type="button" className="ranger__fermer" onClick={onClose} title="Fermer">
            ×
          </button>
        </header>

        <input
          ref={champ}
          className="ranger__filtre"
          placeholder="Filtrer les dossiers…"
          value={filtre}
          onChange={(event) => setFiltre(event.target.value)}
        />

        <div className="ranger__liste">
          {!dossiers && !erreur && <p className="ranger__vide">Lecture du Vault…</p>}
          {dossiers && proposables.length === 0 && (
            <p className="ranger__vide">Aucun dossier ne correspond.</p>
          )}
          {proposables.map((dossier) => {
            const ici = dossier.id === parent;
            return (
              <button
                key={dossier.id || "@racine"}
                type="button"
                className={`ranger__choix${ici ? " is-ici" : ""}`}
                style={{ paddingLeft: `${12 + dossier.depth * 16}px` }}
                disabled={ici || encours}
                onClick={() => void ranger(dossier.id)}
                title={ici ? "Il s'y trouve deja" : `Ranger dans ${dossier.id || dossier.name}`}
              >
                <IconeDossier />
                <span className="ranger__nom">{dossier.name}</span>
                {ici && <span className="ranger__ici">il y est deja</span>}
              </button>
            );
          })}
        </div>

        {erreur && <p className="ranger__erreur">{erreur}</p>}
      </div>
    </div>
  );
}
