/** Depot d'une image venue de l'exterieur sur un element de la scene. */

import { useCallback, useState } from "react";
import { api } from "../lib/api";

interface Options {
  /** Recoit les chemins des images, une fois rangees dans le Vault. */
  onDropped?: (paths: string[], event: React.DragEvent) => void | Promise<void>;
  /**
   * Recoit les fichiers tels quels, sans les ranger. A utiliser quand la
   * destination depend du contexte — l'image de vision doit aller dans le
   * dossier des medias, pas dans le fourre-tout.
   */
  onFiles?: (files: File[], event: React.DragEvent) => void | Promise<void>;
  onError?: (message: string) => void;
  /** Un seul fichier suffit (image de vision d'une porte, par exemple). */
  single?: boolean;
}

export function useImageDrop({ onDropped, onFiles, onError, single = false }: Options) {
  const [over, setOver] = useState(false);

  const onDragOver = useCallback((event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    // Sans ce preventDefault, le navigateur refuse le depot.
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setOver(true);
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent) => {
    // Ignore les passages sur les enfants, qui declenchent aussi cet evenement.
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setOver(false);
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
      event.stopPropagation();
      setOver(false);

      const files = Array.from(event.dataTransfer.files).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (!files.length) {
        onError?.("Seules les images peuvent etre deposees.");
        return;
      }

      const retenus = single ? files.slice(0, 1) : files;
      try {
        if (onFiles) {
          await onFiles(retenus, event);
          return;
        }
        const paths = await Promise.all(retenus.map((file) => api.importFile(file)));
        await onDropped?.(paths, event);
      } catch (problem) {
        onError?.((problem as Error).message);
      }
    },
    [onDropped, onFiles, onError, single],
  );

  return { over, handlers: { onDragOver, onDragLeave, onDrop } };
}
