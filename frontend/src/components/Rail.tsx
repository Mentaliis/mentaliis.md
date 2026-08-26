/**
 * La bande de gauche pendant l'ecriture.
 *
 * Elle montre la porte ou l'on se trouve — pas la racine — pour pouvoir passer
 * d'une note a l'autre, ou changer de porte, sans quitter le texte en cours.
 */

import { useCallback, useRef, useState } from "react";
import type { Scene } from "../lib/types";

/** Bornes de la bande : assez large pour lire un titre, jamais au point d'ecraser le texte. */
const MIN_WIDTH = 140;
const MAX_WIDTH = 520;

interface Props {
  scene: Scene | null;
  activeNoteId: string | null;
  width: number;
  onEnterDoor: (path: string) => void;
  onGoUp: () => void;
  onOpenNote: (id: string, title?: string) => void;
  onCreateNote: () => void | Promise<void>;
  /** Pendant le geste : la largeur suit la souris. */
  onResize: (width: number) => void;
  /** Au relachement : la largeur est enregistree. */
  onResizeEnd: (width: number) => void;
}

export function Rail({
  scene,
  activeNoteId,
  width,
  onEnterDoor,
  onGoUp,
  onOpenNote,
  onCreateNote,
  onResize,
  onResizeEnd,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; width: number } | null>(null);

  const clamp = (value: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(value)));

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      start.current = { x: event.clientX, width };
      setDragging(true);
    },
    [width],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!start.current) return;
      onResize(clamp(start.current.width + event.clientX - start.current.x));
    },
    [onResize],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (!start.current) return;
      const final = clamp(start.current.width + event.clientX - start.current.x);
      (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
      start.current = null;
      setDragging(false);
      onResizeEnd(final);
    },
    [onResizeEnd],
  );

  const poignee = (
    <div
      className={`rail__grip${dragging ? " is-dragging" : ""}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="Largeur de la bande"
      title="Tirer pour elargir"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      // Double-cliquer remet la largeur d'origine.
      onDoubleClick={() => onResizeEnd(210)}
    />
  );

  if (!scene) {
    return (
      <aside className="rail" style={{ width }}>
        {poignee}
      </aside>
    );
  }

  const atRoot = scene.path === "";

  return (
    <aside className="rail" style={{ width }}>
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
                  onClick={() => onOpenNote(note.id, note.title)}
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

      {poignee}
    </aside>
  );
}
