"""Modeles de donnees partages entre le moteur et l'interface."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Position(BaseModel):
    """Position d'un element dans l'espace de la scene."""

    x: float = 0.0
    y: float = 0.0


class AttachedImage(BaseModel):
    """Image accrochee autour d'une note, comme une photo au bout d'un fil."""

    path: str  # chemin relatif au Vault
    position: Position = Field(default_factory=Position)
    caption: str = ""


class Door(BaseModel):
    """Un dossier du Vault, represente comme une porte dans l'environnement."""

    id: str  # chemin relatif au Vault, ex. "Projets/Mentaliis"
    name: str
    parent: str  # chemin relatif du dossier parent ("" pour la racine)
    position: Position = Field(default_factory=Position)
    cover: str | None = None  # image de couverture, chemin relatif au Vault
    note_count: int = 0
    door_count: int = 0


class NoteSummary(BaseModel):
    """Une note telle qu'affichee dans une scene, sans son contenu."""

    id: str  # chemin relatif au Vault, ex. "Projets/idee.md"
    title: str
    parent: str
    position: Position = Field(default_factory=Position)
    images: list[AttachedImage] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    modified: float = 0.0
    excerpt: str = ""


class Note(NoteSummary):
    """Une note avec son contenu markdown et son frontmatter."""

    content: str = ""
    frontmatter: dict = Field(default_factory=dict)


class Camera(BaseModel):
    """Ou l'on regarde dans une scene, et de quelle distance."""

    x: float
    y: float
    scale: float


class SceneResponse(BaseModel):
    """Contenu d'une scene : ce que l'on voit en entrant dans une porte."""

    path: str  # "" pour la racine du Vault
    name: str
    doors: list[Door] = Field(default_factory=list)
    notes: list[NoteSummary] = Field(default_factory=list)
    #: Cadrage retrouve tel qu'on l'avait laisse, ou None a la premiere visite.
    camera: Camera | None = None


class VaultInfo(BaseModel):
    """Le Vault actuellement ouvert."""

    path: str
    name: str
    opened: bool = True


# --- Liens entre notes ---


class LinkRef(BaseModel):
    """Une note reliee a une autre par un [[wikilink]]."""

    id: str
    title: str
    #: le texte tel qu'ecrit dans la note, utile quand il ne resout rien
    label: str = ""


class NoteLinks(BaseModel):
    """Le voisinage d'une note dans le reseau du Vault."""

    id: str
    outgoing: list[LinkRef] = Field(default_factory=list)
    backlinks: list[LinkRef] = Field(default_factory=list)
    #: liens ecrits vers des notes qui n'existent pas encore
    unresolved: list[str] = Field(default_factory=list)


class Edge(BaseModel):
    """Un lien entre deux notes, pour la vue constellation."""

    source: str
    target: str


class Constellation(BaseModel):
    """Tout le Vault d'un seul coup d'oeil."""

    doors: list[Door] = Field(default_factory=list)
    notes: list[NoteSummary] = Field(default_factory=list)
    edges: list[Edge] = Field(default_factory=list)
    camera: Camera | None = None


# --- Corps de requetes ---


class OpenVaultRequest(BaseModel):
    path: str


class SaveNoteRequest(BaseModel):
    content: str


class CreateNoteRequest(BaseModel):
    parent: str = ""
    title: str = "Sans titre"


class CreateDoorRequest(BaseModel):
    parent: str = ""
    name: str = "Nouvelle porte"


class MoveRequest(BaseModel):
    """Deplacement d'une porte ou d'une note dans l'espace de la scene."""

    id: str
    position: Position


class RenameRequest(BaseModel):
    name: str


class SetCoverRequest(BaseModel):
    """Image de couverture d'une porte (chemin relatif au Vault, ou null pour retirer)."""

    cover: str | None = None


class SetImagesRequest(BaseModel):
    """Les images accrochees autour d'une note."""

    images: list[AttachedImage] = Field(default_factory=list)


class SetCameraRequest(BaseModel):
    """Cadrage a retenir pour une scene."""

    camera: Camera


class Settings(BaseModel):
    """Preferences de l'utilisateur, communes a tous ses Vaults."""

    #: Agrandissement de toute l'interface : 1, 2 ou 3 fois.
    zoom: int = Field(default=1, ge=1, le=3)
    #: Largeur de la bande de gauche, en pixels.
    rail_width: int = Field(default=210, ge=140, le=520)
