/** Deplacement d'un element dans l'espace de la scene. */

import { useCallback, useRef, useState } from "react";
import type { Position } from "../lib/types";

interface Options {
  position: Position;
  /** Echelle de la camera : convertit un deplacement ecran en deplacement monde. */
  scale: number;
  onMove: (position: Position) => void;
  onCommit: (position: Position) => void;
  /** Appele si le pointeur est relache sans avoir vraiment bouge : c'est un clic. */
  onClick?: () => void;
}

const CLICK_THRESHOLD = 4; // pixels

export function useDraggable({ position, scale, onMove, onCommit, onClick }: Options) {
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(
    null,
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      start.current = {
        px: event.clientX,
        py: event.clientY,
        x: position.x,
        y: position.y,
        moved: false,
      };
      setDragging(true);
    },
    [position.x, position.y],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const origin = start.current;
      if (!origin) return;
      const dx = event.clientX - origin.px;
      const dy = event.clientY - origin.py;
      if (!origin.moved && Math.hypot(dx, dy) < CLICK_THRESHOLD) return;
      origin.moved = true;
      onMove({ x: origin.x + dx / scale, y: origin.y + dy / scale });
    },
    [onMove, scale],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      const origin = start.current;
      if (!origin) return;
      (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
      start.current = null;
      setDragging(false);
      if (origin.moved) {
        const dx = event.clientX - origin.px;
        const dy = event.clientY - origin.py;
        onCommit({
          x: Math.round(origin.x + dx / scale),
          y: Math.round(origin.y + dy / scale),
        });
      } else {
        onClick?.();
      }
    },
    [onClick, onCommit, scale],
  );

  return { dragging, handlers: { onPointerDown, onPointerMove, onPointerUp } };
}
