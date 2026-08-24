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

export interface Door {
  id: string;
  name: string;
  parent: string;
  position: Position;
  cover: string | null;
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

export interface Scene {
  path: string;
  name: string;
  doors: Door[];
  notes: NoteSummary[];
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
}

/** Message pousse par le moteur quand le Vault change sur le disque. */
export interface EngineEvent {
  type: "vault-changed" | "watch-stopped" | "ping";
  paths?: string[];
  reason?: string;
}
