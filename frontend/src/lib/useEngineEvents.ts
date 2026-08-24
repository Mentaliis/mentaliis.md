/**
 * Ecoute les changements du Vault venus du disque.
 *
 * Le Vault reste un dossier ordinaire : une note modifiee dans un autre editeur,
 * ou un fichier depose a la main, doit apparaitre ici sans avoir a recharger.
 */

import { useEffect, useRef } from "react";
import { EVENTS_URL } from "./api";
import type { EngineEvent } from "./types";

const RECONNECT_DELAY = 1500;

export function useEngineEvents(onChange: (paths: string[]) => void) {
  // Garde la derniere version du callback sans relancer la connexion a chaque rendu.
  const handler = useRef(onChange);
  handler.current = onChange;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: number | undefined;
    let closed = false;

    const connect = () => {
      if (closed) return;
      socket = new WebSocket(EVENTS_URL);

      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as EngineEvent;
          if (event.type === "vault-changed") handler.current(event.paths ?? []);
        } catch {
          // Un message illisible ne doit rien casser.
        }
      };

      // Le moteur peut redemarrer sous nos pieds : on se rebranche tout seul.
      socket.onclose = () => {
        if (!closed) retry = window.setTimeout(connect, RECONNECT_DELAY);
      };
      socket.onerror = () => socket?.close();
    };

    connect();

    return () => {
      closed = true;
      window.clearTimeout(retry);
      socket?.close();
    };
  }, []);
}
