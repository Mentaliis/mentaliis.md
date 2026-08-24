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
