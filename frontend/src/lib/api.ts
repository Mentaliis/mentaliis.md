/**
 * Client du moteur local.
 *
 * Le moteur tourne sur cette machine uniquement (127.0.0.1) : aucune requete
 * ne sort de l'ordinateur, l'application fonctionne hors ligne.
 */

import type {
  AttachedImage,
  Camera,
  Constellation,
  Door,
  DoorIcon,
  Folder,
  MediaLibrary,
  Note,
  NoteLinks,
  NoteSummary,
  Position,
  Scene,
  SceneImage,
  SceneLink,
  Settings,
  VaultInfo,
} from "./types";

// Le moteur de developpement et celui de l'application livree n'ecoutent pas
// au meme endroit : les deux peuvent ainsi tourner cote a cote sans que l'un
// se mette a travailler dans le Vault de l'autre.
const HOST = import.meta.env.DEV ? "127.0.0.1:8757" : "127.0.0.1:8756";
const BASE = `http://${HOST}/api`;
export const EVENTS_URL = `ws://${HOST}/api/events`;

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
  /** L'etat du moteur, et le jeton qui dit lequel il est. */
  health: () => request<{ status: string; token: string | null }>("/health"),

  // --- Preferences ---
  settings: () => request<Settings>("/settings"),
  saveSettings: (settings: Settings) =>
    request<Settings>("/settings", { method: "PUT", ...body(settings) }),

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
  /** Change le titre d'une note : son texte et son nom de fichier ensemble. */
  retitle: (id: string, title: string) =>
    request<Note>(`/note/title?id=${encodeURIComponent(id)}`, {
      method: "PUT",
      ...body({ title }),
    }),
  setImages: (id: string, images: AttachedImage[]) =>
    request<NoteSummary>(`/note/images?id=${encodeURIComponent(id)}`, {
      method: "PUT",
      ...body({ images }),
    }),

  // --- Liens ---
  links: (id: string) => request<NoteLinks>(`/links?id=${encodeURIComponent(id)}`),
  resolveLink: (target: string) =>
    request<{ id: string | null }>(`/links/resolve?target=${encodeURIComponent(target)}`),

  /** Retient le cadrage d'une scene, pour la retrouver telle qu'on l'a laissee. */
  saveCamera: (path: string, camera: Camera) =>
    request<{ ok: true }>(`/camera?path=${encodeURIComponent(path)}`, {
      method: "PUT",
      ...body({ camera }),
    }),

  // --- Vue d'ensemble ---
  constellation: () => request<Constellation>("/constellation"),
  moveGlobally: (id: string, position: Position) =>
    request<{ ok: true }>("/move/global", { method: "PUT", ...body({ id, position }) }),

  // --- Dossier des medias ---
  media: () => request<MediaLibrary>("/media"),

  // --- Images posees dans une scene ---
  addSceneImage: (parent: string, path: string) =>
    request<SceneImage>("/scene/image", { method: "POST", ...body({ parent, path }) }),
  setImageSize: (id: string, size: number) =>
    request<SceneImage>(`/scene/image/size?id=${encodeURIComponent(id)}`, {
      method: "PUT",
      ...body({ size }),
    }),

  // --- Traits entre elements ---
  link: (source: string, target: string) =>
    request<SceneLink>("/link", { method: "POST", ...body({ source, target }) }),
  unlink: (source: string, target: string) =>
    request<{ ok: true }>(
      `/link?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`,
      { method: "DELETE" },
    ),

  // --- Portes ---
  createDoor: (parent: string, name: string) =>
    request<Door>("/door", { method: "POST", ...body({ parent, name }) }),
  /** Tous les dossiers du Vault, pour choisir ou ranger un element. */
  folders: () => request<Folder[]>("/folders"),

  /** Range une note ou une porte dans un autre dossier. Rend son nouvel identifiant. */
  moveTo: (id: string, destination: string) =>
    request<{ id: string }>(`/move-to?id=${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ destination }),
    }),

  setIconSize: (id: string, size: number) =>
    request<Door>(`/door/icon-size?id=${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ size }),
    }),

  setIcon: (id: string, icon: DoorIcon) =>
    request<Door>(`/door/icon?id=${encodeURIComponent(id)}`, {
      method: "PUT",
      ...body({ icon }),
    }),
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

  /** URL d'un fichier du Vault, designe par son chemin exact. */
  fileUrl: (path: string) => `${BASE}/file?path=${encodeURIComponent(path)}`,

  /** URL d'une image citee par son seul nom, ou qu'elle soit dans le Vault. */
  assetUrl: (reference: string) => `${BASE}/asset?ref=${encodeURIComponent(reference)}`,

  /** Toutes les images du Vault, pour les proposer a l'insertion. */
  assets: () => request<string[]>("/assets"),

  /** Range dans le Vault un fichier depose depuis l'exterieur. */
  async importFile(file: File, folder = "Assets"): Promise<string> {
    const payload = new FormData();
    payload.append("file", file);
    const response = await fetch(`${BASE}/import?folder=${encodeURIComponent(folder)}`, {
      method: "POST",
      body: payload, // pas de Content-Type : le navigateur ajoute la frontiere multipart
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      throw new ApiError(detail?.detail ?? "Ce fichier n'a pas pu etre importe.");
    }
    return (await response.json()).path as string;
  },
};

export { ApiError };
