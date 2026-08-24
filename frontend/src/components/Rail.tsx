/**
 * La bande de gauche pendant l'ecriture.
 *
 * Elle montre la porte ou l'on se trouve — pas la racine — pour pouvoir passer
 * d'une note a l'autre, ou changer de porte, sans quitter le texte en cours.
 */

import type { Scene } from "../lib/types";

interface Props {
  scene: Scene | null;
  activeNoteId: string | null;
  onEnterDoor: (path: string) => void;
  onGoUp: () => void;
  onOpenNote: (id: string) => void;
  onCreateNote: () => void;
}

export function Rail({
  scene,
  activeNoteId,
  onEnterDoor,
  onGoUp,
  onOpenNote,
  onCreateNote,
}: Props) {
  if (!scene) return <aside className="rail" />;

  const atRoot = scene.path === "";

  return (
    <aside className="rail">
      <header className="rail__head">
        {!atRoot && (
          <button type="button" className="rail__up" onClick={onGoUp} title="Porte precedente">
            ↑
          </button>
        )}
        <span className="rail__name" title={scene.path || scene.name}>
          {scene.name}
        </span>
      </header>

      <div className="rail__body">
        {scene.doors.length > 0 && (
          <ul className="rail__list">
            {scene.doors.map((door) => (
              <li key={door.id}>
                <button type="button" className="rail__door" onClick={() => onEnterDoor(door.id)}>
                  <span className="rail__icon" aria-hidden="true" />
                  <span className="rail__label">{door.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {scene.notes.length > 0 && (
          <ul className="rail__list">
            {scene.notes.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  className={`rail__note${note.id === activeNoteId ? " is-active" : ""}`}
                  onClick={() => onOpenNote(note.id)}
                >
                  {note.title}
                </button>
              </li>
            ))}
          </ul>
        )}

        {scene.doors.length === 0 && scene.notes.length === 0 && (
          <p className="rail__empty">Porte vide.</p>
        )}
      </div>

      <button type="button" className="rail__new" onClick={onCreateNote}>
        + Nouvelle note
      </button>
    </aside>
  );
}
