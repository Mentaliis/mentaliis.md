/** Types partages avec le moteur Python (voir engine/mentaliis_engine/models.py). */

export interface Position {
  x: number;
  y: number;
}

export interface AttachedImage {
  path: string;
  position: Position;
  caption: string;
}

/** Les apparences possibles d'un dossier dans l'environnement. */
export type DoorIcon = "porte" | "cerveau";

export interface Door {
  id: string;
  name: string;
  parent: string;
  position: Position;
  cover: string | null;
  /** Porte a franchir, ou cerveau : deux facons de se representer un dossier. */
  icon: DoorIcon;
  note_count: number;
  door_count: number;
}

export interface NoteSummary {
  id: string;
  title: string;
  parent: string;
  position: Position;
  images: AttachedImage[];
  tags: string[];
  modified: number;
  excerpt: string;
}

export interface Note extends NoteSummary {
  content: string;
  frontmatter: Record<string, unknown>;
}

/** Ou l'on regarde dans une scene, et de quelle distance. */
export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export interface Scene {
  path: string;
  name: string;
  doors: Door[];
  notes: NoteSummary[];
  /** Cadrage retrouve tel qu'on l'avait laisse, ou null a la premiere visite. */
  camera: Camera | null;
}

export interface VaultInfo {
  path: string;
  name: string;
  opened: boolean;
}

/** Une note reliee a une autre par un [[wikilink]]. */
export interface LinkRef {
  id: string;
  title: string;
  label: string;
}

/** Le voisinage d'une note dans le reseau du Vault. */
export interface NoteLinks {
  id: string;
  outgoing: LinkRef[];
  backlinks: LinkRef[];
  /** Liens ecrits vers des notes qui n'existent pas encore. */
  unresolved: string[];
}

export interface Edge {
  source: string;
  target: string;
}

/** Tout le Vault d'un seul coup d'oeil. */
export interface Constellation {
  doors: Door[];
  notes: NoteSummary[];
  edges: Edge[];
  camera: Camera | null;
}

/** Nom sous lequel la vue d'ensemble retient son propre cadrage. */
export const CONSTELLATION_VIEW = "@constellation";

/** Preferences de l'utilisateur, communes a tous ses Vaults. */
export interface Settings {
  /** Agrandissement de toute l'interface : 1, 2 ou 3 fois. */
  zoom: 1 | 2 | 3;
  /** Largeur de la bande de gauche, en pixels. */
  rail_width: number;
}

export const DEFAULT_SETTINGS: Settings = { zoom: 1, rail_width: 210 };

/** Message pousse par le moteur quand le Vault change sur le disque. */
export interface EngineEvent {
  type: "vault-changed" | "watch-stopped" | "ping";
  paths?: string[];
  reason?: string;
}
