/** Types partages avec le moteur Python (voir engine/mentaliis_engine/models.py). */

export interface Position {
  x: number;
  y: number;
}

export interface AttachedImage {
  path: string;
  position: Position;
  caption: string;
  /** 1 petite, 2 moyenne, 3 grande — pour regarder de plus ou moins pres. */
  size: number;
}

/** Une image posee dans une scene, a cote des portes et des notes. */
export interface SceneImage {
  id: string;
  path: string;
  parent: string;
  position: Position;
  /** 1 a l'echelle du cerveau, 2 et 3 de plus en plus grandes. */
  size: number;
  caption: string;
}

/**
 * Apparence d'un dossier : « porte », « cerveau », ou le chemin d'une icone
 * rangee par l'utilisateur dans `.MEDIAS/.SVG`.
 */
export type DoorIcon = string;

/** Les deux apparences fournies avec le logiciel. */
export const BUILTIN_ICONS = ["porte", "cerveau"] as const;

export interface Door {
  id: string;
  name: string;
  parent: string;
  position: Position;
  cover: string | null;
  /** Porte a franchir, ou cerveau : deux facons de se representer un dossier. */
  icon: DoorIcon;
  /** Trois echelles : 1 celle de la porte, 2 un quart de plus, 3 le double. */
  icon_size: number;
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

/** Un trait tire a la main entre deux elements d'une scene. */
export interface SceneLink {
  source: string;
  target: string;
}

export interface Scene {
  path: string;
  name: string;
  doors: Door[];
  notes: NoteSummary[];
  /** Images posees librement dans la scene. */
  images: SceneImage[];
  links: SceneLink[];
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

/** Un fichier de la reserve, avec la famille dont il releve. */
export interface MediaFile {
  path: string;
  /** image, video, audio ou fichier — c'est elle qui decide du rendu. */
  kind: "image" | "video" | "audio" | "fichier";
}

/** La reserve de medias du Vault, au nom impose. */
export interface MediaLibrary {
  /** Toujours `.MEDIAS`. */
  folder: string;
  /** Faux tant que l'utilisateur ne l'a pas cree lui-meme. */
  exists: boolean;
  images: string[];
  /** Tout ce qu'elle contient, images comprises, par famille. */
  files: MediaFile[];
  /** Toujours `.MEDIAS/.SVG`. */
  icons_folder: string;
  icons_exist: boolean;
  icons: string[];
}

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
