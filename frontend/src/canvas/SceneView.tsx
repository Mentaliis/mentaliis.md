/** L'environnement : la scene dans laquelle flottent les portes et les notes. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { Door, NoteSummary, Position, Scene, SceneLink } from "../lib/types";
import { ContextMenu, type MenuItem } from "../components/ContextMenu";
import { useDialog } from "../components/Dialog";
import { MediaPicker, type MediaKind } from "../components/MediaPicker";
import { DoorNode } from "./DoorNode";
import { NoteNode } from "./NoteNode";
import { type Anchor, SceneLinks } from "./SceneLinks";
import { useRememberedCamera, useViewport } from "./useViewport";

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
  /** Porte dont on choisit la vision ou l'apparence, et lequel des deux. */
  const [picking, setPicking] = useState<{ door: Door; kind: MediaKind } | null>(null);
  const [links, setLinks] = useState<SceneLink[]>(scene.links);
  /** Trait en cours de trace, tant qu'on n'a pas relache. */
  const [pending, setPending] = useState<{ from: string; to: Position } | null>(null);
  /** Hauteur mesuree de chaque element : c'est elle qui place l'accroche des traits. */
  const [heights, setHeights] = useState<Map<string, number>>(new Map());
  const dialog = useDialog();
  const viewport = useViewport();
  const surface = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDoors(scene.doors);
    setNotes(scene.notes);
    setLinks(scene.links);
  }, [scene]);

  // Les elements n'ont pas tous la meme hauteur — un cerveau fait le double
  // d'une porte — donc on la mesure plutot que de la deviner.
  useLayoutEffect(() => {
    const found = new Map<string, number>();
    world.current?.querySelectorAll<HTMLElement>("[data-node-id]").forEach((element) => {
      const id = element.dataset.nodeId;
      if (id) found.set(id, element.offsetHeight);
    });
    setHeights((current) => {
      const identique =
        current.size === found.size && [...found].every(([id, h]) => current.get(id) === h);
      return identique ? current : found;
    });
  }, [doors, notes]);

  /** Un trait s'accroche au centre de l'element. */
  const anchors = new Map<string, Anchor>();
  for (const item of [...doors, ...notes]) {
    anchors.set(item.id, {
      x: item.position.x,
      y: item.position.y - 1 + (heights.get(item.id) ?? 130) / 2,
    });
  }

  /** Ou se trouve un point de l'ecran dans le monde de la scene. */
  const toWorld = useCallback(
    (clientX: number, clientY: number): Position => {
      const rect = surface.current?.getBoundingClientRect();
      const { x, y, scale } = viewport.camera;
      return {
        x: (clientX - (rect?.left ?? 0) - x) / scale,
        y: (clientY - (rect?.top ?? 0) - y) / scale,
      };
    },
    [viewport.camera],
  );

  const startLink = useCallback(
    (id: string, event: React.PointerEvent) => {
      // Sans cela, le geste deplacerait l'element au lieu de tirer un trait.
      event.stopPropagation();
      event.preventDefault();
      setPending({ from: id, to: toWorld(event.clientX, event.clientY) });
    },
    [toWorld],
  );

  // Le trait suit la souris, et s'attache a ce qu'on lache dessous.
  useEffect(() => {
    if (!pending) return;

    const suivre = (event: PointerEvent) =>
      setPending((current) =>
        current ? { ...current, to: toWorld(event.clientX, event.clientY) } : null,
      );

    const lacher = async (event: PointerEvent) => {
      setPending(null);
      const sous = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-node-id]");
      const cible = sous?.dataset.nodeId;
      if (!cible || cible === pending.from) return;
      try {
        const cree = await api.link(pending.from, cible);
        setLinks((current) =>
          current.some((l) => l.source === cree.source && l.target === cree.target)
            ? current
            : [...current, cree],
        );
      } catch (problem) {
        onError((problem as Error).message);
      }
    };

    window.addEventListener("pointermove", suivre);
    window.addEventListener("pointerup", lacher, { once: true });
    return () => {
      window.removeEventListener("pointermove", suivre);
      window.removeEventListener("pointerup", lacher);
    };
  }, [onError, pending, toWorld]);

  const detach = useCallback(
    (link: SceneLink) => {
      setLinks((current) =>
        current.filter((l) => !(l.source === link.source && l.target === link.target)),
      );
      void api.unlink(link.source, link.target).catch((problem) => {
        onError((problem as Error).message);
        onSceneChanged();
      });
    },
    [onError, onSceneChanged],
  );

  // On retrouve la porte exactement comme on l'avait laissee.
  useRememberedCamera(
    scene.path,
    scene.camera,
    viewport,
    [...scene.doors, ...scene.notes].map((item) => item.position),
    surface,
  );

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

  /** Menu d'une porte ou d'une note. `door` vaut null pour une note. */
  const itemMenu = useCallback(
    (id: string, name: string, door: Door | null): MenuItem[] => [
      {
        label: "Renommer",
        action: async () => {
          const next = await dialog.prompt({
            title: door ? "Renommer la porte" : "Renommer la note",
            value: name,
            confirmLabel: "Renommer",
          });
          if (next && next !== name) {
            await api.rename(id, next);
            onSceneChanged();
          }
        },
      },
      ...(door
        ? [
            {
              label: "Changer d'icone",
              action: () => setPicking({ door, kind: "icone" as MediaKind }),
            },
            {
              label: door.cover ? "Changer l'image de vision" : "Choisir une image de vision",
              action: () => setPicking({ door, kind: "vision" as MediaKind }),
            },
          ]
        : []),
      {
        label: "Supprimer",
        danger: true,
        action: async () => {
          const sure = await dialog.confirm({
            title: `Supprimer « ${name} » ?`,
            message:
              "Rien n'est efface definitivement : tout part dans la corbeille du Vault, dans le dossier .mentaliis.",
            confirmLabel: "Mettre a la corbeille",
            danger: true,
          });
          if (sure) {
            await api.remove(id);
            onSceneChanged();
          }
        },
      },
    ],
    [dialog, onSceneChanged],
  );

  const backgroundMenu = useCallback(
    (): MenuItem[] => [
      {
        label: "Nouvelle note",
        action: async () => {
          const title = await dialog.prompt({
            title: "Nouvelle note",
            message: `Dans ${scene.name}.`,
            value: "Sans titre",
            confirmLabel: "Creer",
          });
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
          const name = await dialog.prompt({
            title: "Nouvelle porte",
            message: `Dans ${scene.name}.`,
            value: "Nouvelle porte",
            confirmLabel: "Creer",
          });
          if (name) {
            await api.createDoor(scene.path, name);
            onSceneChanged();
          }
        },
      },
    ],
    [dialog, onOpenNote, onSceneChanged, scene.name, scene.path],
  );

  return (
    <div className="scene">
      {/* Le nom de la porte, toujours au meme endroit : on sait d'un coup d'oeil
          ou l'on se trouve, sans lire le fil d'Ariane. */}
      <div className="scene__banner">{scene.name}</div>

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
        <div ref={world} className="scene__world" style={viewport.worldStyle}>
          <SceneLinks
            links={links}
            anchors={anchors}
            pending={pending}
            scale={viewport.camera.scale}
            onDetach={detach}
          />

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
              onStartLink={(event) => startLink(door.id, event)}
              onContextMenu={(event) =>
                openMenu(event, itemMenu(door.id, door.name, door))
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
              onStartLink={(event) => startLink(note.id, event)}
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

      {picking && (
        <MediaPicker
          kind={picking.kind}
          door={picking.door}
          onClose={() => setPicking(null)}
          onPickVision={async (path) => {
            const porte = picking.door;
            setPicking(null);
            try {
              await api.setCover(porte.id, path);
              onSceneChanged();
            } catch (problem) {
              onError((problem as Error).message);
            }
          }}
          onPickIcon={async (icon) => {
            const porte = picking.door;
            setPicking(null);
            try {
              await api.setIcon(porte.id, icon);
              onSceneChanged();
            } catch (problem) {
              onError((problem as Error).message);
            }
          }}
        />
      )}

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
