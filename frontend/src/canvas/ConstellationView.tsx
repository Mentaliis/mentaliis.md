/**
 * La vue d'ensemble : tout le Vault d'un seul coup d'oeil.
 *
 * Chaque porte est un noyau, ses notes gravitent autour, et les [[wikilinks]]
 * tirent des fils entre elles. Pas de fleches : ce n'est pas un organigramme,
 * c'est un ciel — on cherche des constellations, pas un sens de lecture.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { CONSTELLATION_VIEW, type Constellation, type Position } from "../lib/types";
import { useDraggable } from "./useDraggable";
import { useRememberedCamera, useViewport } from "./useViewport";

interface Props {
  data: Constellation;
  activeNoteId: string | null;
  onEnterDoor: (path: string) => void;
  onOpenNote: (id: string) => void;
}

export function ConstellationView({ data, activeNoteId, onEnterDoor, onOpenNote }: Props) {
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const viewport = useViewport();
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const next: Record<string, Position> = {};
    for (const item of [...data.doors, ...data.notes]) next[item.id] = item.position;
    setPositions(next);
  }, [data]);

  // Le ciel se retrouve tel qu'on l'avait laisse.
  useRememberedCamera(
    CONSTELLATION_VIEW,
    data.camera,
    viewport,
    [...data.doors, ...data.notes].map((item) => item.position),
    surface,
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

  const moveLocal = useCallback((id: string, position: Position) => {
    setPositions((prev) => ({ ...prev, [id]: position }));
  }, []);

  const commit = useCallback(
    (id: string, position: Position) => {
      moveLocal(id, position);
      void api.moveGlobally(id, position);
    },
    [moveLocal],
  );

  /** Les notes reliees a celle qu'on survole, pour eclairer sa constellation. */
  const highlighted = useMemo(() => {
    if (!hovered) return new Set<string>();
    const set = new Set<string>([hovered]);
    for (const edge of data.edges) {
      if (edge.source === hovered) set.add(edge.target);
      if (edge.target === hovered) set.add(edge.source);
    }
    return set;
  }, [data.edges, hovered]);

  // Etendue du calque des fils : un SVG ne peut pas avoir de coordonnees negatives
  // sans etre decale, on l'ancre donc sur le coin haut-gauche du nuage de points.
  const bounds = useMemo(() => {
    const points = Object.values(positions);
    if (!points.length) return { left: 0, top: 0, width: 1, height: 1 };
    const margin = 400;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const left = Math.min(...xs) - margin;
    const top = Math.min(...ys) - margin;
    return {
      left,
      top,
      width: Math.max(...xs) - left + margin,
      height: Math.max(...ys) - top + margin,
    };
  }, [positions]);

  return (
    <div className="scene">
      <div
        ref={surface}
        className={`scene__surface scene__surface--sky${viewport.panning ? " is-panning" : ""}`}
        onWheel={viewport.onWheel}
        onPointerDown={viewport.onPointerDown}
        onPointerMove={viewport.onPointerMove}
        onPointerUp={viewport.onPointerUp}
        onPointerCancel={viewport.onPointerUp}
      >
        <div className="scene__world" style={viewport.worldStyle}>
          <svg
            className="sky__threads"
            style={{ left: bounds.left, top: bounds.top }}
            width={bounds.width}
            height={bounds.height}
          >
            {data.edges.map((edge) => {
              const from = positions[edge.source];
              const to = positions[edge.target];
              if (!from || !to) return null;
              const lit = highlighted.has(edge.source) && highlighted.has(edge.target);
              return (
                <line
                  key={`${edge.source}|${edge.target}`}
                  className={lit ? "sky__thread is-lit" : "sky__thread"}
                  x1={from.x - bounds.left}
                  y1={from.y - bounds.top}
                  x2={to.x - bounds.left}
                  y2={to.y - bounds.top}
                />
              );
            })}
          </svg>

          {data.doors.map((door) => (
            <Star
              key={door.id}
              kind="door"
              id={door.id}
              label={door.name}
              cover={door.cover}
              position={positions[door.id] ?? door.position}
              scale={viewport.camera.scale}
              dimmed={hovered !== null && !highlighted.has(door.id)}
              onHover={setHovered}
              onMove={moveLocal}
              onCommit={commit}
              onActivate={() => onEnterDoor(door.id)}
            />
          ))}

          {data.notes.map((note) => (
            <Star
              key={note.id}
              kind="note"
              id={note.id}
              label={note.title}
              position={positions[note.id] ?? note.position}
              scale={viewport.camera.scale}
              active={note.id === activeNoteId}
              dimmed={hovered !== null && !highlighted.has(note.id)}
              onHover={setHovered}
              onMove={moveLocal}
              onCommit={commit}
              onActivate={() => onOpenNote(note.id)}
            />
          ))}
        </div>

        {data.doors.length === 0 && data.notes.length === 0 && (
          <div className="scene__empty">
            <p>Le Vault est vide.</p>
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
            viewport.fit(Object.values(positions), element.clientWidth, element.clientHeight);
          }}
        >
          ⤢
        </button>
      </div>

      <div className="sky__legend">
        {data.doors.length} porte{data.doors.length > 1 ? "s" : ""} · {data.notes.length} note
        {data.notes.length > 1 ? "s" : ""} · {data.edges.length} lien
        {data.edges.length > 1 ? "s" : ""}
      </div>
    </div>
  );
}

/** Un point du ciel : une porte ou une note. */
function Star({
  kind,
  id,
  label,
  cover,
  position,
  scale,
  active = false,
  dimmed,
  onHover,
  onMove,
  onCommit,
  onActivate,
}: {
  kind: "door" | "note";
  id: string;
  label: string;
  cover?: string | null;
  position: Position;
  scale: number;
  active?: boolean;
  dimmed: boolean;
  onHover: (id: string | null) => void;
  onMove: (id: string, position: Position) => void;
  onCommit: (id: string, position: Position) => void;
  onActivate: () => void;
}) {
  const { dragging, handlers } = useDraggable({
    position,
    scale,
    onMove: (next) => onMove(id, next),
    onCommit: (next) => onCommit(id, next),
    onClick: onActivate,
  });

  const classes = [
    "star",
    `star--${kind}`,
    dragging && "is-dragging",
    active && "is-active",
    dimmed && "is-dimmed",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      onPointerEnter={() => onHover(id)}
      onPointerLeave={() => onHover(null)}
      {...handlers}
    >
      <div className="star__dot">
        {cover && <img src={api.fileUrl(cover)} alt="" draggable={false} />}
      </div>
      <span className="star__label">{label}</span>
    </div>
  );
}
