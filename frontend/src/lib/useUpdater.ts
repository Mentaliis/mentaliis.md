/**
 * La mise a jour de Mentaliis.
 *
 * L'application interroge la page des versions publiees, verifie la signature
 * du paquet propose, le telecharge et se relance. Rien de tout cela n'existe
 * hors de la fenetre native : dans un simple navigateur, en developpement, le
 * crochet reste muet plutot que d'echouer bruyamment.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Ou en est la recherche, du repos jusqu'a la version installee. */
export type UpdateState =
  | { etat: "repos" }
  | { etat: "recherche" }
  | { etat: "a-jour" }
  | { etat: "disponible"; version: string; notes: string }
  | { etat: "telechargement"; progres: number }
  | { etat: "installation" }
  | { etat: "echec"; raison: string };

/** Vrai seulement dans la fenetre native : ailleurs, il n'y a rien a mettre a jour. */
function dansLApplication(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function useUpdater() {
  const [state, setState] = useState<UpdateState>({ etat: "repos" });
  /** La mise a jour trouvee, gardee entre la proposition et l'acceptation. */
  const trouvee = useRef<{ version: string; downloadAndInstall: Function } | null>(null);
  /** Ne jamais toucher a l'etat apres le demontage du composant. */
  const vivant = useRef(true);
  useEffect(() => {
    vivant.current = true;
    return () => {
      vivant.current = false;
    };
  }, []);
  const poser = useCallback((valeur: UpdateState) => {
    if (vivant.current) setState(valeur);
  }, []);

  /** Va voir s'il existe une version plus recente. */
  const chercher = useCallback(
    async (silencieux = false) => {
      if (!dansLApplication()) {
        if (!silencieux) poser({ etat: "echec", raison: "hors de l'application" });
        return;
      }
      poser({ etat: "recherche" });
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const mise = await check();
        if (!mise) {
          trouvee.current = null;
          poser({ etat: "a-jour" });
          return;
        }
        trouvee.current = mise as never;
        poser({
          etat: "disponible",
          version: mise.version,
          notes: (mise.body ?? "").trim(),
        });
      } catch (error) {
        trouvee.current = null;
        // Une recherche automatique qui echoue — machine hors ligne, page des
        // versions injoignable — ne doit rien montrer du tout.
        poser(silencieux ? { etat: "repos" } : { etat: "echec", raison: String(error) });
      }
    },
    [poser],
  );

  /** Telecharge la version proposee, puis relance Mentaliis dessus. */
  const installer = useCallback(async () => {
    const mise = trouvee.current;
    if (!mise) return;
    poser({ etat: "telechargement", progres: 0 });
    try {
      let total = 0;
      let recu = 0;
      await mise.downloadAndInstall((evenement: { event: string; data?: never }) => {
        const data = (evenement.data ?? {}) as { contentLength?: number; chunkLength?: number };
        if (evenement.event === "Started") {
          total = data.contentLength ?? 0;
        } else if (evenement.event === "Progress") {
          recu += data.chunkLength ?? 0;
          poser({
            etat: "telechargement",
            progres: total > 0 ? Math.min(1, recu / total) : 0,
          });
        } else if (evenement.event === "Finished") {
          poser({ etat: "installation" });
        }
      });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (error) {
      poser({ etat: "echec", raison: String(error) });
    }
  }, [poser]);

  /** Referme la proposition sans installer : on la reverra au prochain demarrage. */
  const ignorer = useCallback(() => {
    poser({ etat: "repos" });
  }, [poser]);

  // Une seule recherche discrete au demarrage, un peu apres l'ouverture pour
  // laisser la fenetre s'afficher sans concurrence.
  useEffect(() => {
    if (!dansLApplication()) return;
    const minuterie = window.setTimeout(() => void chercher(true), 3000);
    return () => window.clearTimeout(minuterie);
  }, [chercher]);

  return { state, chercher, installer, ignorer };
}
