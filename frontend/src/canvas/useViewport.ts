/**
 * Deplacement et zoom de la camera dans une scene.
 *
 * Le rendu reste net a tous les niveaux de zoom : `will-change: transform` n'est
 * pose que pendant le geste. Le laisser en permanence ferait rasteriser la scene
 * une fois pour toutes, puis l'agrandirait comme une image — le texte deviendrait
 * flou des qu'on zoome.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface Camera {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.15;
const MAX_SCALE = 4;

/** Delai apres lequel on considere le geste termine, et on redonne de la nettete. */
const SETTLE_MS = 180;

export function useViewport(initial: Camera = { x: 0, y: 0, scale: 1 }) {
  const [camera, setCamera] = useState<Camera>(initial);
  const [panning, setPanning] = useState(false);
  const [moving, setMoving] = useState(false);

  const origin = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null);
  const settle = useRef<number | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);
  const pending = useRef<{ px: number; py: number; delta: number } | null>(null);

  /** Signale qu'un geste est en cours, et programme la remise au net. */
  const beginGesture = useCallback(() => {
    setMoving(true);
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => setMoving(false), SETTLE_MS);
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(settle.current);
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    [],
  );

  /** Zoom centre sur le curseur : le point sous la souris reste sous la souris. */
  const onWheel = useCallback(
    (event: React.WheelEvent) => {
      const rect = event.currentTarget.getBoundingClientRect();
      // Les molettes crantees envoient des paliers, les pavés tactiles un flux
      // continu : on ramene tout a une meme echelle avant d'appliquer le zoom.
      const step = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      pending.current = {
        px: event.clientX - rect.left,
        py: event.clientY - rect.top,
        delta: (pending.current?.delta ?? 0) + step,
      };
      beginGesture();

      // Plusieurs evenements peuvent arriver entre deux images : on n'en garde
      // qu'un seul calcul par image affichee.
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = undefined;
        const gesture = pending.current;
        pending.current = null;
        if (!gesture) return;
        setCamera((prev) => {
          const scale = clamp(prev.scale * Math.exp(-gesture.delta * 0.0016), MIN_SCALE, MAX_SCALE);
          const ratio = scale / prev.scale;
          return {
            scale,
            x: gesture.px - (gesture.px - prev.x) * ratio,
            y: gesture.py - (gesture.py - prev.y) * ratio,
          };
        });
      });
    },
    [beginGesture],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      // Le fond deplace la camera ; le bouton du milieu aussi, ou qu'on soit.
      const onBackground = event.target === event.currentTarget;
      if (event.button === 1) event.preventDefault();
      else if (!onBackground || event.button !== 0) return;

      event.currentTarget.setPointerCapture(event.pointerId);
      origin.current = { px: event.clientX, py: event.clientY, cx: camera.x, cy: camera.y };
      setPanning(true);
      beginGesture();
    },
    [beginGesture, camera.x, camera.y],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const start = origin.current;
      if (!start) return;
      beginGesture();
      setCamera((prev) => ({
        ...prev,
        x: start.cx + (event.clientX - start.px),
        y: start.cy + (event.clientY - start.py),
      }));
    },
    [beginGesture],
  );

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
    const scale = clamp(Math.min(width / (maxX - minX), height / (maxY - minY)), MIN_SCALE, 1);
    setCamera({
      scale,
      x: width / 2 - ((minX + maxX) / 2) * scale,
      y: height / 2 - ((minY + maxY) / 2) * scale,
    });
  }, []);

  /** Zoom par palier, en gardant le centre de la vue immobile. */
  const zoomBy = useCallback(
    (factor: number, width?: number, height?: number) => {
      beginGesture();
      setCamera((prev) => {
        const scale = clamp(prev.scale * factor, MIN_SCALE, MAX_SCALE);
        const ratio = scale / prev.scale;
        const cx = (width ?? 0) / 2;
        const cy = (height ?? 0) / 2;
        return { scale, x: cx - (cx - prev.x) * ratio, y: cy - (cy - prev.y) * ratio };
      });
    },
    [beginGesture],
  );

  /** Style a poser sur le calque qui contient les elements. */
  const worldStyle: React.CSSProperties = {
    transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`,
    willChange: moving ? "transform" : "auto",
  };

  return {
    camera,
    panning,
    worldStyle,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    fit,
    zoomBy,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
