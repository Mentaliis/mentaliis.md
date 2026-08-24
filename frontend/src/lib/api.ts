/**
 * Client du moteur local.
 *
 * Le moteur tourne sur cette machine uniquement (127.0.0.1) : aucune requete
 * ne sort de l'ordinateur, l'application fonctionne hors ligne.
 */

import type { Door, Note, NoteSummary, Position, Scene, VaultInfo } from "./types";

const BASE = "http://127.0.0.1:8756/api";

class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(BASE + path, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError("Le moteur ne repond pas. Est-il demarre ?");
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new ApiError(detail?.detail ?? `Erreur ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const body = (payload: unknown) => ({ body: JSON.stringify(payload) });

export const api = {
  health: () => request<{ status: string }>("/health"),

  // --- Vault ---
  getVault: () => request<VaultInfo | null>("/vault"),
  lastVault: () => request<{ path: string | null }>("/vault/last"),
  openVault: (path: string) =>
    request<VaultInfo>("/vault/open", { method: "POST", ...body({ path }) }),

  // --- Scenes ---
  scene: (path = "") => request<Scene>(`/scene?path=${encodeURIComponent(path)}`),

  // --- Notes ---
  note: (id: string) => request<Note>(`/note?id=${encodeURIComponent(id)}`),
  saveNote: (id: string, content: string) =>
    request<Note>(`/note?id=${encodeURIComponent(id)}`, { method: "PUT", ...body({ content }) }),
  createNote: (parent: string, title: string) =>
    request<NoteSummary>("/note", { method: "POST", ...body({ parent, title }) }),

  // --- Portes ---
  createDoor: (parent: string, name: string) =>
    request<Door>("/door", { method: "POST", ...body({ parent, name }) }),
  setCover: (id: string, cover: string | null) =>
    request<Door>(`/door/cover?id=${encodeURIComponent(id)}`, { method: "PUT", ...body({ cover }) }),

  // --- Commun ---
  move: (id: string, position: Position) =>
    request<{ ok: true }>("/move", { method: "PUT", ...body({ id, position }) }),
  rename: (id: string, name: string) =>
    request<{ id: string }>(`/rename?id=${encodeURIComponent(id)}`, {
      method: "PUT",
      ...body({ name }),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/item?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  // --- Recherche ---
  search: (q: string) => request<NoteSummary[]>(`/search?q=${encodeURIComponent(q)}`),

  /** URL d'un fichier du Vault (image de couverture, image attachee). */
  fileUrl: (path: string) => `${BASE}/file?path=${encodeURIComponent(path)}`,
};

export { ApiError };
