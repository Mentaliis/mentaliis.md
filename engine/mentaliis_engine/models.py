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
    #: 1 petite, 2 moyenne, 3 grande — pour regarder de plus ou moins pres.
    size: int = Field(default=1, ge=1, le=3)


#: Les deux apparences fournies avec le logiciel.
BUILTIN_ICONS = ("porte", "cerveau")

#: Apparence d'un dossier : « porte », « cerveau », ou le chemin d'une icone
#: rangee par l'utilisateur dans `.MEDIAS/.SVG`.
DoorIcon = str


class Door(BaseModel):
    """Un dossier du Vault, represente comme une porte dans l'environnement."""

    id: str  # chemin relatif au Vault, ex. "Projets/Mentaliis"
    name: str
    parent: str  # chemin relatif du dossier parent ("" pour la racine)
    position: Position = Field(default_factory=Position)
    cover: str | None = None  # image de couverture, chemin relatif au Vault
    #: Porte a franchir, ou cerveau : deux facons de se representer un dossier.
    icon: DoorIcon = "porte"
    #: Trois echelles : 1 celle de la porte, 2 un quart de plus, 3 le double.
    #: Le cerveau naît en 3 — il represente la connaissance, et le premier
    #: reglage voulu pour lui etait deja le double de la porte.
    icon_size: int = Field(default=1, ge=1, le=3)
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


class SceneImage(BaseModel):
    """Une image posee dans une scene, a cote des portes et des notes.

    Elle n'est pas un fichier du Vault : c'est un renvoi vers un media de la
    reserve, place ou l'on veut, et reliable comme n'importe quel element.
    """

    id: str  # cle interne, ex. "@image/3f2a"
    path: str  # media de la reserve
    parent: str
    position: Position = Field(default_factory=Position)
    #: 1 a l'echelle du cerveau, 2 et 3 de plus en plus grandes.
    size: int = Field(default=1, ge=1, le=3)
    caption: str = ""


class SceneLink(BaseModel):
    """Un trait tire a la main entre deux elements d'une scene."""

    source: str
    target: str


class SceneResponse(BaseModel):
    """Contenu d'une scene : ce que l'on voit en entrant dans une porte."""

    path: str  # "" pour la racine du Vault
    name: str
    doors: list[Door] = Field(default_factory=list)
    notes: list[NoteSummary] = Field(default_factory=list)
    #: Images posees librement dans la scene.
    images: list[SceneImage] = Field(default_factory=list)
    #: Liens tires a la main entre les elements presents dans cette scene.
    links: list[SceneLink] = Field(default_factory=list)
    #: Cadrage retrouve tel qu'on l'avait laisse, ou None a la premiere visite.
    camera: Camera | None = None


class Session(BaseModel):
    """Ou l'on en etait dans un Vault, pour y revenir tel quel."""

    #: La porte ouverte ; la chaine vide designe la racine.
    path: str = ""
    #: Les notes ouvertes en onglets, dans l'ordre.
    tabs: list[str] = Field(default_factory=list)
    #: Celle que l'on lisait.
    active: str | None = None


class Folder(BaseModel):
    """Un dossier du Vault, tel qu'on le propose comme destination."""

    #: Chemin relatif ; la chaine vide designe la racine.
    id: str
    name: str
    #: Profondeur dans l'arborescence, pour l'indentation de la liste.
    depth: int


class MoveToRequest(BaseModel):
    """Ou ranger l'element ; la chaine vide designe la racine du Vault."""

    destination: str = ""


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


class RetitleRequest(BaseModel):
    """Nouveau titre d'une note."""

    title: str


class AddSceneImageRequest(BaseModel):
    """Image a poser dans une scene."""

    parent: str = ""
    path: str


class SetSizeRequest(BaseModel):
    """Taille d'affichage : 1 petite, 2 moyenne, 3 grande."""

    size: int = Field(ge=1, le=3)


class LinkRequest(BaseModel):
    """Les deux bouts d'un trait a attacher ou detacher."""

    source: str
    target: str


class SetIconSizeRequest(BaseModel):
    size: int = Field(ge=1, le=3)


class SetIconRequest(BaseModel):
    """Apparence a donner a une porte."""

    icon: DoorIcon


class SetCoverRequest(BaseModel):
    """Image de couverture d'une porte (chemin relatif au Vault, ou null pour retirer)."""

    cover: str | None = None


class SetImagesRequest(BaseModel):
    """Les images accrochees autour d'une note."""

    images: list[AttachedImage] = Field(default_factory=list)


class SetCameraRequest(BaseModel):
    """Cadrage a retenir pour une scene."""

    camera: Camera


class MediaFile(BaseModel):
    """Un fichier de la reserve, avec la famille dont il releve."""

    path: str
    #: image, video, audio ou fichier — c'est elle qui decide du rendu.
    kind: str


class MediaLibrary(BaseModel):
    """La reserve de medias du Vault, au nom impose."""

    #: Chemin du dossier attendu, toujours le meme.
    folder: str
    #: Faux tant que l'utilisateur ne l'a pas cree lui-meme.
    exists: bool = False
    #: Images qu'il contient, chemins relatifs au Vault.
    images: list[str] = Field(default_factory=list)
    #: Tout ce qu'elle contient, images comprises, par famille.
    files: list[MediaFile] = Field(default_factory=list)
    #: Sous-dossier des icones de portes.
    icons_folder: str
    icons_exist: bool = False
    #: Icones disponibles pour habiller une porte.
    icons: list[str] = Field(default_factory=list)


class Settings(BaseModel):
    """Preferences de l'utilisateur, communes a tous ses Vaults."""

    #: Agrandissement de toute l'interface : 1, 2 ou 3 fois.
    zoom: int = Field(default=1, ge=1, le=3)
    #: Largeur de la bande de gauche, en pixels.
    rail_width: int = Field(default=210, ge=140, le=520)
