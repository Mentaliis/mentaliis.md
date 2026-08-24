/** Deplacement et zoom de la camera dans une scene. */

import { useCallback, useRef, useState } from "react";

export interface Camera {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;

export function useViewport(initial: Camera = { x: 0, y: 0, scale: 1 }) {
  const [camera, setCamera] = useState<Camera>(initial);
  const [panning, setPanning] = useState(false);
  const origin = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null);

  /** Zoom centre sur le curseur : le point sous la souris reste sous la souris. */
  const onWheel = useCallback((event: React.WheelEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    setCamera((prev) => {
      const factor = Math.exp(-event.deltaY * 0.0015);
      const scale = clamp(prev.scale * factor, MIN_SCALE, MAX_SCALE);
      const ratio = scale / prev.scale;
      return {
        scale,
        x: px - (px - prev.x) * ratio,
        y: py - (py - prev.y) * ratio,
      };
    });
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      // Fond uniquement : un clic sur une carte ne doit pas deplacer la camera.
      if (event.target !== event.currentTarget) return;
      // Bouton gauche ou molette.
      if (event.button !== 0 && event.button !== 1) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      origin.current = { px: event.clientX, py: event.clientY, cx: camera.x, cy: camera.y };
      setPanning(true);
    },
    [camera.x, camera.y],
  );

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    const start = origin.current;
    if (!start) return;
    setCamera((prev) => ({
      ...prev,
      x: start.cx + (event.clientX - start.px),
      y: start.cy + (event.clientY - start.py),
    }));
  }, []);

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    if (!origin.current) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    origin.current = null;
    setPanning(false);
  }, []);

  /** Recadre la camera pour que tous les elements tiennent a l'ecran. */
  const fit = useCallback((points: { x: number; y: number }[], width: number, height: number) => {
    if (!points.length) {
      setCamera({ x: width / 2, y: height / 2, scale: 1 });
      return;
    }
    const margin = 220;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs) - margin;
    const maxX = Math.max(...xs) + margin;
    const minY = Math.min(...ys) - margin;
    const maxY = Math.max(...ys) + margin;
    const scale = clamp(
      Math.min(width / (maxX - minX), height / (maxY - minY)),
      MIN_SCALE,
      1,
    );
    setCamera({
      scale,
      x: width / 2 - ((minX + maxX) / 2) * scale,
      y: height / 2 - ((minY + maxY) / 2) * scale,
    });
  }, []);

  const zoomBy = useCallback((factor: number) => {
    setCamera((prev) => ({ ...prev, scale: clamp(prev.scale * factor, MIN_SCALE, MAX_SCALE) }));
  }, []);

  return { camera, panning, onWheel, onPointerDown, onPointerMove, onPointerUp, fit, zoomBy };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
