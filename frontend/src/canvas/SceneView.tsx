/** L'environnement : la scene dans laquelle flottent les portes et les notes. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { Door, NoteSummary, Position, Scene } from "../lib/types";
import { ContextMenu, type MenuItem } from "../components/ContextMenu";
import { DoorNode } from "./DoorNode";
import { NoteNode } from "./NoteNode";
import { useViewport } from "./useViewport";

interface Props {
  scene: Scene;
  activeNoteId: string | null;
  onEnterDoor: (path: string) => void;
  onOpenNote: (id: string) => void;
  onSceneChanged: () => void;
  onError: (message: string) => void;
}

interface Menu {
  x: number;
  y: number;
  items: MenuItem[];
}

export function SceneView({
  scene,
  activeNoteId,
  onEnterDoor,
  onOpenNote,
  onSceneChanged,
  onError,
}: Props) {
  const [doors, setDoors] = useState<Door[]>(scene.doors);
  const [notes, setNotes] = useState<NoteSummary[]>(scene.notes);
  const [menu, setMenu] = useState<Menu | null>(null);
  const viewport = useViewport();
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDoors(scene.doors);
    setNotes(scene.notes);
  }, [scene]);

  // Recadre la camera a chaque changement de scene, pour ne jamais arriver dans le vide.
  const { fit } = viewport;
  useLayoutEffect(() => {
    const element = surface.current;
    if (!element) return;
    const points = [...scene.doors, ...scene.notes].map((item) => item.position);
    fit(points, element.clientWidth, element.clientHeight);
  }, [fit, scene]);

  const moveLocal = useCallback((id: string, position: Position) => {
    const apply = <T extends { id: string; position: Position }>(items: T[]) =>
      items.map((item) => (item.id === id ? { ...item, position } : item));
    setDoors((prev) => apply(prev));
    setNotes((prev) => apply(prev));
  }, []);

  const commit = useCallback(
    (id: string, position: Position) => {
      moveLocal(id, position);
      void api.move(id, position);
    },
    [moveLocal],
  );

  /** Zoome autour du centre de la vue, pas du coin. */
  const { zoomBy } = viewport;
  const zoom = useCallback(
    (factor: number) => {
      const element = surface.current;
      zoomBy(factor, element?.clientWidth, element?.clientHeight);
    },
    [zoomBy],
  );

  const openMenu = useCallback(
    (event: React.MouseEvent, items: MenuItem[]) => {
      event.preventDefault();
      event.stopPropagation();
      setMenu({ x: event.clientX, y: event.clientY, items });
    },
    [],
  );

  const itemMenu = useCallback(
    (id: string, name: string, hasCover: boolean | null): MenuItem[] => [
      {
        label: "Renommer",
        action: async () => {
          const next = window.prompt("Nouveau nom", name);
          if (next && next !== name) {
            await api.rename(id, next);
            onSceneChanged();
          }
        },
      },
      // L'image de vision se pose en la lachant sur la porte : ne reste ici
      // que le moyen de la retirer.
      ...(hasCover
        ? [
            {
              label: "Retirer l'image de vision",
              action: async () => {
                await api.setCover(id, null);
                onSceneChanged();
              },
            },
          ]
        : []),
      {
        label: "Supprimer",
        danger: true,
        action: async () => {
          if (window.confirm(`Envoyer "${name}" a la corbeille du Vault ?`)) {
            await api.remove(id);
            onSceneChanged();
          }
        },
      },
    ],
    [onSceneChanged],
  );

  const backgroundMenu = useCallback(
    (): MenuItem[] => [
      {
        label: "Nouvelle note",
        action: async () => {
          const title = window.prompt("Titre de la note", "Sans titre");
          if (title) {
            const note = await api.createNote(scene.path, title);
            onSceneChanged();
            onOpenNote(note.id);
          }
        },
      },
      {
        label: "Nouvelle porte",
        action: async () => {
          const name = window.prompt("Nom de la porte", "Nouvelle porte");
          if (name) {
            await api.createDoor(scene.path, name);
            onSceneChanged();
          }
        },
      },
    ],
    [onOpenNote, onSceneChanged, scene.path],
  );

  return (
    <div className="scene">
      <div
        ref={surface}
        className={`scene__surface${viewport.panning ? " is-panning" : ""}`}
        onWheel={viewport.onWheel}
        onPointerDown={viewport.onPointerDown}
        onPointerMove={viewport.onPointerMove}
        onPointerUp={viewport.onPointerUp}
        onPointerCancel={viewport.onPointerUp}
        onContextMenu={(event) => {
          if (event.target === event.currentTarget) openMenu(event, backgroundMenu());
        }}
      >
        <div className="scene__world" style={viewport.worldStyle}>
          {doors.map((door) => (
            <DoorNode
              key={door.id}
              door={door}
              scale={viewport.camera.scale}
              onMove={(position) => moveLocal(door.id, position)}
              onCommit={(position) => commit(door.id, position)}
              onEnter={() => onEnterDoor(door.id)}
              onChanged={onSceneChanged}
              onError={onError}
              onContextMenu={(event) =>
                openMenu(event, itemMenu(door.id, door.name, Boolean(door.cover)))
              }
            />
          ))}

          {notes.map((note) => (
            <NoteNode
              key={note.id}
              note={note}
              scale={viewport.camera.scale}
              active={note.id === activeNoteId}
              onMove={(position) => moveLocal(note.id, position)}
              onCommit={(position) => commit(note.id, position)}
              onOpen={() => onOpenNote(note.id)}
              onChanged={onSceneChanged}
              onError={onError}
              onContextMenu={(event) => openMenu(event, itemMenu(note.id, note.title, null))}
            />
          ))}
        </div>

        {doors.length === 0 && notes.length === 0 && (
          <div className="scene__empty">
            <p>Cette scene est vide.</p>
            <p className="scene__hint">Clic droit pour creer une porte ou une note.</p>
          </div>
        )}
      </div>

      <div className="scene__controls">
        <button type="button" onClick={() => zoom(1.25)} title="Zoomer">
          +
        </button>
        <button type="button" onClick={() => zoom(1 / 1.25)} title="Dezoomer">
          −
        </button>
        <button
          type="button"
          title="Tout voir"
          onClick={() => {
            const element = surface.current;
            if (!element) return;
            viewport.fit(
              [...doors, ...notes].map((item) => item.position),
              element.clientWidth,
              element.clientHeight,
            );
          }}
        >
          ⤢
        </button>
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
