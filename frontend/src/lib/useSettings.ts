/**
 * Les preferences de l'utilisateur, et leur effet immediat sur l'interface.
 *
 * L'agrandissement passe par le zoom natif de la fenetre quand l'application
 * tourne dans sa coquille Tauri : c'est le navigateur lui-meme qui remet toute
 * la page a l'echelle, sans reflouter le texte ni fausser les coordonnees de la
 * souris. Dans un navigateur ordinaire on retombe sur la propriete CSS `zoom`,
 * qui produit le meme resultat.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { DEFAULT_SETTINGS, type Settings } from "./types";

/** True quand l'application tourne dans sa fenetre native. */
const inTauri = "__TAURI_INTERNALS__" in window;

async function applyZoom(zoom: number) {
  if (inTauri) {
    try {
      const { getCurrentWebview } = await import("@tauri-apps/api/webview");
      await getCurrentWebview().setZoom(zoom);
      return;
    } catch {
      // La fenetre refuse le zoom natif : le CSS prend le relais.
    }
  }
  document.documentElement.style.zoom = zoom === 1 ? "" : String(zoom);
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .settings()
      .then((found) => {
        if (cancelled) return;
        setSettings(found);
        void applyZoom(found.zoom);
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
      if (next.zoom !== current.zoom) void applyZoom(next.zoom);
      void api.saveSettings(next).catch(() => undefined);
      return next;
    });
  }, []);

  return { settings, update, loaded };
}
