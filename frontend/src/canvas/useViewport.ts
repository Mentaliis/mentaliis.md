/**
 * Deplacement et zoom de la camera dans une scene.
 *
 * Le rendu reste net a tous les niveaux de zoom : `will-change: transform` n'est
 * pose que pendant le geste. Le laisser en permanence ferait rasteriser la scene
 * une fois pour toutes, puis l'agrandirait comme une image — le texte deviendrait
 * flou des qu'on zoome.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { Camera } from "../lib/types";

export type { Camera };

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
      // Les traits se survolent grace a une bande invisible plus large qu'eux :
      // elle doit laisser passer le geste, sinon le fond se bloque le long de
      // chaque trait. Seule la croix de detachement garde le pointeur.
      const target = event.target as HTMLElement;
      const onBackground =
        target === event.currentTarget ||
        (Boolean(target.closest?.(".links-layer")) && !target.closest?.(".link__detach"));
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

  /** Repose la camera exactement ou elle etait. */
  const apply = useCallback((next: Camera) => setCamera(next), []);

  /** Recadre la camera pour que tous les elements tiennent a l'ecran. */
  const fit = useCallback((points: { x: number; y: number }[], width: number, height: number) => {
    // Une surface pas encore mise en page annonce zero : cadrer dessus placerait
    // le monde dans le coin superieur gauche, a peu pres tout hors de l'ecran.
    // Mieux vaut ne rien faire et laisser le cadrage suivant s'en charger.
    if (!(width > 0) || !(height > 0)) return;
    if (!points.length) {
      setCamera({ x: width / 2, y: height / 2, scale: 1 });
      return;
    }
    const margin = 220;
    // Une position illisible — un fichier de mise en page abime, un calcul qui
    // a derape — empoisonnerait tout le cadrage : on l'ecarte.
    const sains = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (!sains.length) return;
    const xs = sains.map((point) => point.x);
    const ys = sains.map((point) => point.y);
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
    apply,
    fit,
    zoomBy,
  };
}

/**
 * Retrouve le cadrage laisse la derniere fois, et retient celui qu'on adopte.
 *
 * Sans cela, entrer dans une porte recadre tout automatiquement : les elements
 * n'ont pas bouge, mais ils apparaissent ailleurs a l'ecran — on croit avoir
 * perdu leur position.
 */
export function useRememberedCamera(
  scenePath: string,
  saved: Camera | null | undefined,
  viewport: ReturnType<typeof useViewport>,
  /** Ce que la scene contient, pour un premier cadrage quand rien n'est retenu. */
  points: { x: number; y: number }[],
  surface: React.RefObject<HTMLDivElement | null>,
) {
  const { apply, fit, camera } = viewport;
  //: Cadrage venu du moteur : il ne doit pas etre renvoye tel quel.
  const applied = useRef("");

  useLayoutEffect(() => {
    const element = surface.current;
    if (!element) return;
    // Un cadrage abime — fichier de mise en page corrompu, echelle nulle — ne
    // doit pas etre applique : il rendrait la scene invisible.
    const sain =
      saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && saved.scale > 0;
    if (saved && sain) {
      // On compare les valeurs, pas les objets : la scene se recharge souvent, et
      // chaque rechargement rapporte un cadrage neuf mais identique. Le reappliquer
      // annulerait un deplacement en cours, pas encore enregistre.
      const signe = signature(saved);
      if (signe === applied.current) return;
      applied.current = signe;
      apply(saved);
    } else {
      // Premiere visite : on cadre sur ce qui existe, et ce cadrage sera retenu.
      applied.current = "";
      fit(points, element.clientWidth, element.clientHeight);
    }
    // Volontairement lie a la scene, pas aux points : bouger un element ne doit
    // pas rebrasser la camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apply, fit, scenePath, saved, surface]);

  // Enregistre le cadrage un peu apres le dernier geste, pas a chaque image.
  useEffect(() => {
    const current = signature(camera);
    if (current === applied.current) return;
    const timer = window.setTimeout(() => {
      applied.current = current;
      void api.saveCamera(scenePath, camera).catch(() => undefined);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [camera, scenePath]);
}

function signature(camera: Camera) {
  return `${Math.round(camera.x)}|${Math.round(camera.y)}|${camera.scale.toFixed(3)}`;
}

function clamp(value: number, min: number, max: number) {
  // `Math.min(max, Math.max(min, NaN))` vaut NaN : les bornes ne rattrapent
  // rien. Or un seul NaN dans la camera rend `transform: scale(NaN)`, que le
  // navigateur refuse — le calque entier cesse d'etre peint, et l'ecran devient
  // noir alors que tout est pourtant en place.
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
