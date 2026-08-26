/**
 * Les preferences de l'utilisateur, et leur effet immediat sur l'interface.
 *
 * Deux echelles distinctes, a ne pas confondre :
 *
 * - celle de l'application entiere, fixee une fois pour toutes, qui rend
 *   l'ensemble un peu plus grand que la taille brute du navigateur ;
 * - celle de l'ecriture, reglable en trois niveaux, qui n'agit que sur la zone
 *   d'edition du markdown.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { DEFAULT_SETTINGS, type Settings } from "./types";

/** L'application est un cran plus grande que la taille brute du navigateur. */
const BASE_ZOOM = 1.1;

/** Trois paliers rapproches : chacun agrandit un peu l'ecriture, sans casser la mise en page. */
const ECHELLES_ECRITURE: Record<number, number> = { 1: 1, 2: 1.15, 3: 1.32 };

/** True quand l'application tourne dans sa fenetre native. */
const inTauri = "__TAURI_INTERNALS__" in window;

/** Agrandit toute la fenetre, une seule fois au demarrage. */
async function applyBaseZoom() {
  if (inTauri) {
    try {
      const { getCurrentWebview } = await import("@tauri-apps/api/webview");
      await getCurrentWebview().setZoom(BASE_ZOOM);
      return;
    } catch {
      // La fenetre refuse le zoom natif : le CSS prend le relais.
    }
  }
  document.documentElement.style.zoom = String(BASE_ZOOM);
}

/** Ne touche qu'a la zone d'ecriture. */
function applyEditorScale(niveau: number) {
  const echelle = ECHELLES_ECRITURE[niveau] ?? 1;
  document.documentElement.style.setProperty("--editor-scale", String(echelle));
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void applyBaseZoom();
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .settings()
      .then((found) => {
        if (cancelled) return;
        setSettings(found);
        applyEditorScale(found.zoom);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  /** Change une preference, l'applique tout de suite, et l'enregistre. */
  const update = useCallback((change: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...change };
      if (next.zoom !== current.zoom) applyEditorScale(next.zoom);
      void api.saveSettings(next).catch(() => undefined);
      return next;
    });
  }, []);

  return { settings, update, loaded };
}
