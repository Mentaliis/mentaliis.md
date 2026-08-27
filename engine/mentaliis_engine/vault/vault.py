"""Le Vault : dossier racine qui contient tout.

Un dossier -> une porte. Un fichier `.md` -> une note. Rien d'autre n'est invente :
le Vault est un vrai dossier sur le disque, lisible par n'importe quel autre outil.
"""

from __future__ import annotations

import json
import math
import shutil
import time
from pathlib import Path
from uuid import uuid4

from ..config import (
    AUDIO_EXTENSIONS,
    IMAGE_EXTENSIONS,
    DOCUMENT_EXTENSIONS,
    ICON_EXTENSIONS,
    ICONS_DIR,
    IGNORED_DIRS,
    MEDIAS_DIR,
    NOTE_EXTENSIONS,
    SETTINGS_FILE,
    VIDEO_EXTENSIONS,
    VAULT_META_DIR,
    app_data_dir,
)
from ..models import (
    Folder,
    AttachedImage,
    Camera,
    Constellation,
    Door,
    BUILTIN_ICONS,
    MediaFile,
    MediaLibrary,
    Note,
    NoteLinks,
    NoteSummary,
    Position,
    SceneImage,
    SceneLink,
    SceneResponse,
    VaultInfo,
)
from . import markdown as md
from .layout import Layout

#: Prefixe des positions de la vue constellation. Un element a deux places :
#: une dans sa scene, une dans la vue d'ensemble — elles n'ont rien a voir.
GLOBAL = "@constellation/"

#: Prefixe du cadrage retenu pour chaque scene.
CAMERA = "@camera/"

#: Nom sous lequel la vue d'ensemble retient son propre cadrage.
CONSTELLATION_VIEW = "@constellation"

#: Dossier ou atterrissent les images deposees, tant qu'aucun dossier de medias
#: n'a ete designe.
ASSETS_DIR = "Assets"

#: Cle sous laquelle le Vault retient ses reglages propres.
CONFIG = "@config"

#: Prefixe des images posees librement dans une scene. Elles ne sont pas des
#: fichiers : ce sont des renvois vers la reserve, ranges dans le layout.
IMAGE = "@image/"



class VaultError(Exception):
    """Erreur metier renvoyee telle quelle a l'interface."""


class Vault:
    """Un Vault ouvert."""

    def __init__(self, root: Path) -> None:
        root = root.expanduser().resolve()
        if not root.is_dir():
            raise VaultError(f"Ce dossier n'existe pas : {root}")
        self.root = root
        self.layout = Layout(root)
        (root / VAULT_META_DIR).mkdir(exist_ok=True)

        # La reserve de medias et son dossier d'icones portent des noms imposes,
        # et toute l'application les suppose presents. Les creer a l'ouverture
        # evite d'avoir a expliquer leur existence : on ouvre un dossier, il est
        # deja un Vault. On ne touche a rien s'ils sont deja la — pas meme pour
        # verifier leur contenu, qui appartient a celui qui l'a range.
        (root / MEDIAS_DIR / ICONS_DIR).mkdir(parents=True, exist_ok=True)

        # Import tardif : l'index a besoin du type Vault, defini ici.
        from ..index import LinkIndex

        self.links = LinkIndex(self)

        #: Ecritures faites par l'application elle-meme, pour que la surveillance
        #: du disque ne les renvoie pas a l'interface comme des changements externes.
        self._own_writes: dict[str, float] = {}

        #: Index des images du Vault, construit a la demande.
        self._assets: dict[str, str] | None = None

    def invalidate_caches(self) -> None:
        """A appeler quand le disque a change sous nos pieds."""
        self.links.invalidate()
        self._assets = None

    def _touch(self, path: Path) -> None:
        now = time.time()
        self._own_writes[str(path.resolve())] = now
        # Purge les traces trop vieilles pour rester pertinentes.
        for key, when in list(self._own_writes.items()):
            if now - when > 5.0:
                del self._own_writes[key]

    def wrote_recently(self, path: Path, within: float = 2.0) -> bool:
        """Vrai si l'application vient d'ecrire ici, ou juste en dessous.

        Ecrire un fichier fait aussi remonter un changement sur le dossier qui le
        contient : sans cela, chaque enregistrement reviendrait a l'interface
        deguise en modification externe.
        """
        target = Path(path).resolve()
        cutoff = time.time() - within
        for written, when in self._own_writes.items():
            if when < cutoff:
                continue
            candidate = Path(written)
            if candidate == target or candidate.parent == target:
                return True
        return False

    # --- Chemins ---

    @property
    def name(self) -> str:
        return self.root.name

    def resolve(self, rel: str) -> Path:
        """Convertit un chemin relatif en chemin absolu, sans jamais sortir du Vault."""
        rel = (rel or "").strip().replace("\\", "/").strip("/")
        target = (self.root / rel).resolve() if rel else self.root
        try:
            target.relative_to(self.root)
        except ValueError:
            raise VaultError("Chemin hors du Vault.") from None
        return target

    def relative(self, path: Path) -> str:
        return path.resolve().relative_to(self.root).as_posix()

    # --- Lecture d'une scene ---

    def scene(self, path: str = "") -> SceneResponse:
        """Ce que l'on voit en entrant dans une porte : ses portes et ses notes."""
        folder = self.resolve(path)
        if not folder.is_dir():
            raise VaultError(f"Cette porte n'existe pas : {path}")

        doors: list[Door] = []
        notes: list[NoteSummary] = []

        for entry in sorted(folder.iterdir(), key=lambda p: p.name.lower()):
            if entry.name.startswith(".") or entry.name in IGNORED_DIRS:
                continue
            if entry.is_dir():
                doors.append(self._door(entry, parent=path))
            elif entry.suffix.lower() in NOTE_EXTENSIONS:
                notes.append(self._note_summary(entry, parent=path))

        images = self.scene_images(path)
        self._auto_place(doors, notes)
        return SceneResponse(
            path=path,
            name=self.name if not path else folder.name,
            doors=doors,
            notes=notes,
            images=images,
            links=self._links_within({item.id for item in [*doors, *notes, *images]}),
            camera=self.camera(path),
        )

    def _links_within(self, present: set[str]) -> list[SceneLink]:
        """Ne renvoie que les traits dont les deux bouts sont dans cette scene."""
        return [
            SceneLink(source=source, target=target)
            for source, target in self.layout.links()
            if source in present and target in present
        ]

    # --- Images posees dans une scene ---

    def scene_images(self, parent: str) -> list[SceneImage]:
        """Les images posees dans cette scene, dans l'ordre ou elles sont venues."""
        trouvees: list[SceneImage] = []
        for key, entry in self.layout.entries(IMAGE):
            if entry.get("parent") != parent or not isinstance(entry.get("path"), str):
                continue
            trouvees.append(
                SceneImage(
                    id=key,
                    path=entry["path"],
                    parent=parent,
                    position=Position(x=entry.get("x", 0.0), y=entry.get("y", 0.0)),
                    size=_taille(entry.get("size")),
                    caption=entry.get("caption") or "",
                )
            )
        return trouvees

    def add_scene_image(self, parent: str, path: str) -> SceneImage:
        """Pose une image de la reserve dans une scene."""
        folder = self.resolve(parent)
        if not folder.is_dir():
            raise VaultError(f"Cette porte n'existe pas : {parent}")
        self._check_media(path)

        key = f"{IMAGE}{uuid4().hex[:8]}"
        self.layout.set_field(key, "path", path)
        self.layout.set_field(key, "parent", parent)
        # Elle arrive au centre : on la deplacera ou l'on veut.
        self.layout.set_position(key, 0.0, 0.0)
        return SceneImage(id=key, path=path, parent=parent)

    def set_image_size(self, image_id: str, size: int) -> SceneImage:
        """Trois tailles, pour regarder de plus ou moins pres."""
        entry = self.layout.get(image_id)
        if not entry.get("path"):
            raise VaultError(f"Cette image n'existe pas : {image_id}")
        self.layout.set_field(image_id, "size", _taille(size))
        return next(
            image for image in self.scene_images(entry.get("parent", "")) if image.id == image_id
        )

    def _check_media(self, path: str) -> None:
        """Une image posee vient de la reserve, comme toutes les autres."""
        self.resolve(path)
        if not path.startswith(MEDIAS_DIR + "/"):
            raise VaultError(f"Une image doit venir de {MEDIAS_DIR}.")
        if Path(path).suffix.lower() not in IMAGE_EXTENSIONS:
            raise VaultError(f"Ce fichier n'est pas une image : {path}")
        if not self.resolve(path).is_file():
            raise VaultError(f"Cette image n'existe pas : {path}")

    # --- Reserve de medias ---

    @property
    def medias_dir(self) -> Path:
        return self.root / MEDIAS_DIR

    @property
    def icons_dir(self) -> Path:
        return self.medias_dir / ICONS_DIR

    def _files_under(self, folder: Path, extensions: set[str]) -> list[str]:
        """Fichiers d'un dossier de la reserve, chemins relatifs au Vault.

        Le parcours ordinaire du Vault saute tout ce qui commence par un point :
        la reserve doit donc etre lue a part, sinon elle serait invisible.
        """
        if not folder.is_dir():
            return []
        found: list[str] = []
        for item in folder.rglob("*"):
            if item.is_file() and item.suffix.lower() in extensions:
                found.append(self.relative(item))
        return sorted(found)

    def media(self) -> MediaLibrary:
        """Ce que contient la reserve, et si elle existe seulement."""
        return MediaLibrary(
            folder=MEDIAS_DIR,
            exists=self.medias_dir.is_dir(),
            images=[
                path
                for path in self._files_under(self.medias_dir, IMAGE_EXTENSIONS)
                # Les icones ont leur propre rayon : on ne les melange pas aux visions.
                if not path.startswith(f"{MEDIAS_DIR}/{ICONS_DIR}/")
            ],
            files=self._media_files(),
            icons_folder=f"{MEDIAS_DIR}/{ICONS_DIR}",
            icons_exist=self.icons_dir.is_dir(),
            icons=self._files_under(self.icons_dir, ICON_EXTENSIONS),
        )

    def _media_files(self) -> list[MediaFile]:
        """Tout ce que la reserve contient, range par famille."""
        familles = {
            "image": IMAGE_EXTENSIONS,
            "video": VIDEO_EXTENSIONS,
            "audio": AUDIO_EXTENSIONS,
            "fichier": DOCUMENT_EXTENSIONS,
        }
        connues = set().union(*familles.values())
        trouves: list[MediaFile] = []
        for path in self._files_under(self.medias_dir, connues):
            # Les icones ont leur propre rayon : elles n'entrent pas dans les notes.
            if path.startswith(f"{MEDIAS_DIR}/{ICONS_DIR}/"):
                continue
            suffix = Path(path).suffix.lower()
            kind = next(nom for nom, exts in familles.items() if suffix in exts)
            trouves.append(MediaFile(path=path, kind=kind))
        return trouves

    # --- Traits entre elements ---

    def link(self, source: str, target: str) -> SceneLink:
        """Attache deux elements par un trait."""
        if source == target:
            raise VaultError("Un element ne peut pas etre relie a lui-meme.")
        if self._scene_of(source) != self._scene_of(target):
            raise VaultError("Un trait ne relie que deux elements d'une meme scene.")
        self.layout.link(source, target)
        return SceneLink(source=source, target=target)

    def unlink(self, source: str, target: str) -> None:
        self.layout.unlink(source, target)

    def _scene_of(self, item_id: str) -> str:
        """Dans quelle scene vit cet element ? Une image posee le sait d'elle-meme."""
        if item_id.startswith(IMAGE):
            entry = self.layout.get(item_id)
            if not entry.get("path"):
                raise VaultError(f"Introuvable : {item_id}")
            return entry.get("parent", "")
        if not self.resolve(item_id).exists():
            raise VaultError(f"Introuvable : {item_id}")
        return Path(item_id).parent.as_posix().strip(".")

    # --- Cadrage ---

    def camera(self, path: str) -> Camera | None:
        """Ou l'on regardait la derniere fois dans cette scene."""
        stored = self.layout.get(CAMERA + path)
        if {"x", "y", "scale"} <= stored.keys():
            return Camera(x=stored["x"], y=stored["y"], scale=stored["scale"])
        return None

    def set_camera(self, path: str, camera: Camera) -> None:
        """Retient le cadrage : rouvrir une porte doit rendre la meme vue."""
        key = CAMERA + path
        self.layout.set_position(key, round(camera.x, 2), round(camera.y, 2))
        self.layout.set_field(key, "scale", round(camera.scale, 4))

    def _door(self, folder: Path, parent: str) -> Door:
        rel = self.relative(folder)
        stored = self.layout.get(rel)
        note_count = 0
        door_count = 0
        try:
            for child in folder.iterdir():
                if child.name.startswith(".") or child.name in IGNORED_DIRS:
                    continue
                if child.is_dir():
                    door_count += 1
                elif child.suffix.lower() in NOTE_EXTENSIONS:
                    note_count += 1
        except OSError:
            pass
        return Door(
            id=rel,
            name=folder.name,
            parent=parent,
            position=Position(x=stored.get("x", 0.0), y=stored.get("y", 0.0)),
            cover=stored.get("cover"),
            icon=_icon_of(stored),
            icon_size=_icon_size_of(stored),
            note_count=note_count,
            door_count=door_count,
        )

    def _note_summary(self, file: Path, parent: str) -> NoteSummary:
        rel = self.relative(file)
        stored = self.layout.get(rel)
        try:
            content, meta = md.read(file)
        except OSError:
            content, meta = "", {}
        images = [AttachedImage(**item) for item in stored.get("images", [])]
        return NoteSummary(
            id=rel,
            title=md.title_of(file, content, meta),
            parent=parent,
            position=Position(x=stored.get("x", 0.0), y=stored.get("y", 0.0)),
            images=images,
            tags=md.tags_of(content, meta),
            modified=file.stat().st_mtime,
            excerpt=md.excerpt_of(content),
        )

    def _auto_place(self, doors: list[Door], notes: list[NoteSummary]) -> None:
        """Donne une place aux elements jamais positionnes.

        Les nouveaux elements sont disposes en spirale autour du centre plutot
        qu'empiles a l'origine, pour que la scene soit lisible des la premiere ouverture.
        La position est ecrite une seule fois : l'utilisateur reste maitre du placement.
        """
        placed = [*doors, *notes]
        unplaced = [item for item in placed if self.layout.position(item.id) is None]
        if not unplaced:
            return

        start = sum(1 for item in placed if self.layout.position(item.id) is not None)
        # Large : un cerveau fait 300 px de cote, deux voisins ne doivent pas
        # se recouvrir a la premiere ouverture d'une porte.
        radius_step = 330.0
        for offset, item in enumerate(unplaced):
            index = start + offset
            # spirale : chaque anneau contient un peu plus d'elements que le precedent
            ring = int((math.sqrt(1 + 4 * index / 3) - 1) / 2) + 1 if index else 0
            per_ring = max(1, ring * 6)
            position_in_ring = index - (3 * ring * (ring - 1) if ring else 0)
            angle = (position_in_ring / per_ring) * math.tau + ring * 0.4
            x = round(math.cos(angle) * radius_step * ring, 1)
            y = round(math.sin(angle) * radius_step * ring, 1)
            item.position = Position(x=x, y=y)
            self.layout.set_position(item.id, x, y)

    # --- Notes ---

    def read_note(self, note_id: str) -> Note:
        file = self.resolve(note_id)
        if not file.is_file():
            raise VaultError(f"Cette note n'existe pas : {note_id}")
        content, meta = md.read(file)
        summary = self._note_summary(file, parent=str(Path(note_id).parent.as_posix()).strip("."))
        return Note(**summary.model_dump(), content=content, frontmatter=meta)

    def write_note(self, note_id: str, content: str) -> Note:
        file = self.resolve(note_id)
        if file.suffix.lower() not in NOTE_EXTENSIONS:
            raise VaultError("Seuls les fichiers markdown peuvent etre ecrits.")
        _, meta = md.read(file) if file.exists() else ("", {})
        md.write(file, content, meta)
        self._touch(file)
        self.links.invalidate()
        return self.read_note(note_id)

    def create_note(self, parent: str, title: str) -> NoteSummary:
        folder = self.resolve(parent)
        if not folder.is_dir():
            raise VaultError(f"Cette porte n'existe pas : {parent}")
        file = _unique(folder / f"{_safe_name(title)}.md")
        # Le titre ecrit dans le texte suit le nom finalement retenu : deux notes
        # creees a la suite s'appellent « Nouvelle Note » puis « Nouvelle Note (1) »,
        # a l'ecran comme sur le disque.
        md.write(file, f"# {file.stem}\n\n")
        self._touch(file)
        self.links.invalidate()
        return self._note_summary(file, parent=parent)

    def retitle(self, note_id: str, title: str) -> Note:
        """Change le titre d'une note, partout ou il est ecrit.

        Le titre affiche vient du frontmatter, sinon du premier `# titre`, sinon
        du nom de fichier. Renommer le seul fichier ne changerait donc souvent
        rien a l'ecran : on met les trois d'accord d'un coup.
        """
        title = (title or "").strip()
        if not title:
            raise VaultError("Un titre ne peut pas etre vide.")
        file = self.resolve(note_id)
        if not file.is_file():
            raise VaultError(f"Cette note n'existe pas : {note_id}")

        content, meta = md.read(file)
        if isinstance(meta.get("title"), str):
            meta["title"] = title
        else:
            content = md.with_title(content, title)
        md.write(file, content, meta)
        self._touch(file)

        new_id = self.rename(note_id, title)
        return self.read_note(new_id)

    def set_images(self, note_id: str, images: list[AttachedImage]) -> NoteSummary:
        """Remplace les images accrochees autour d'une note."""
        file = self.resolve(note_id)
        if not file.is_file():
            raise VaultError(f"Cette note n'existe pas : {note_id}")
        for image in images:
            self.resolve(image.path)  # chaque image doit vivre dans le Vault
            if not image.path.startswith(MEDIAS_DIR + "/"):
                raise VaultError(f"Une image doit venir de {MEDIAS_DIR}.")
        self.layout.set_field(
            note_id,
            "images",
            [image.model_dump() for image in images] or None,
        )
        parent = Path(note_id).parent.as_posix().strip(".")
        return self._note_summary(file, parent=parent)

    # --- Portes ---

    def create_door(self, parent: str, name: str) -> Door:
        folder = self.resolve(parent)
        if not folder.is_dir():
            raise VaultError(f"Cette porte n'existe pas : {parent}")
        new = _unique(folder / _safe_name(name))
        new.mkdir(parents=True)
        self._touch(new)
        return self._door(new, parent=parent)

    # --- Fichiers deposes ---

    def import_file(self, filename: str, data: bytes, folder: str = ASSETS_DIR) -> str:
        """Range un fichier depose dans le Vault et renvoie son chemin relatif."""
        suffix = Path(filename).suffix.lower()
        if suffix not in IMAGE_EXTENSIONS:
            raise VaultError(f"Ce type de fichier n'est pas accepte : {suffix or 'inconnu'}")
        destination = self.resolve(folder)
        destination.mkdir(parents=True, exist_ok=True)
        target = _unique(destination / (_safe_name(Path(filename).stem) + suffix))
        target.write_bytes(data)
        self._touch(target)
        self._assets = None
        return self.relative(target)

    # --- Images du Vault ---

    def _asset_index(self) -> dict[str, str]:
        """Index de toutes les images, par nom de fichier et par chemin.

        Une note peut donc ecrire `![[schema.png]]` sans se soucier du
        sous-dossier ou l'image se trouve reellement.
        """
        if self._assets is not None:
            return self._assets

        index: dict[str, str] = {}
        for file in self.root.rglob("*"):
            if not file.is_file() or file.suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            parts = file.relative_to(self.root).parts
            if any(part in IGNORED_DIRS or part.startswith(".") for part in parts[:-1]):
                continue
            rel = self.relative(file)
            # Le chemin complet est sans ambiguite ; le nom seul sert de
            # raccourci, et le premier trouve gagne pour rester stable.
            index[rel.lower()] = rel
            index.setdefault(file.name.lower(), rel)
            index.setdefault(file.stem.lower(), rel)

        self._assets = index
        return index

    def find_asset(self, reference: str) -> Path | None:
        """Retrouve une image citee par son nom seul, ou par son chemin."""
        key = reference.strip().replace("\\", "/").lstrip("./").lower()
        if not key:
            return None
        rel = self._asset_index().get(key)
        if rel is None:
            # Derniere chance : la reference contient un chemin, on garde le nom.
            rel = self._asset_index().get(Path(key).name.lower())
        return self.root / rel if rel else None

    def list_assets(self) -> list[str]:
        """Toutes les images du Vault, chemins relatifs, sans doublon."""
        return sorted(set(self._asset_index().values()))

    # --- Operations communes ---

    def move(self, item_id: str, x: float, y: float) -> None:
        # Une image posee n'est pas un fichier : elle n'a rien a valider sur le disque.
        if not item_id.startswith(IMAGE):
            self.resolve(item_id)  # valide que la cible est bien dans le Vault
        self.layout.set_position(item_id, x, y)

    def set_cover(self, door_id: str, cover: str | None) -> Door:
        folder = self.resolve(door_id)
        if not folder.is_dir():
            raise VaultError(f"Cette porte n'existe pas : {door_id}")
        if cover:
            self.resolve(cover)  # la couverture doit vivre dans le Vault
            if not cover.startswith(MEDIAS_DIR + "/"):
                raise VaultError(f"Une image de vision doit venir de {MEDIAS_DIR}.")
        self.layout.set_field(door_id, "cover", cover)
        parent = Path(door_id).parent.as_posix().strip(".")
        return self._door(folder, parent=parent)

    def set_icon(self, door_id: str, icon: str) -> Door:
        """Change l'apparence d'une porte sans toucher au dossier lui-meme."""
        folder = self.resolve(door_id)
        if not folder.is_dir():
            raise VaultError(f"Cette porte n'existe pas : {door_id}")
        if icon not in BUILTIN_ICONS:
            self._check_icon(icon)
        # "porte" etant la valeur par defaut, on ne l'ecrit pas.
        self.layout.set_field(door_id, "icon", None if icon == "porte" else icon)
        parent = Path(door_id).parent.as_posix().strip(".")
        return self._door(folder, parent=parent)

    def set_icon_size(self, door_id: str, size: int) -> Door:
        """Change l'echelle de l'icone d'une porte, sans toucher au dossier."""
        if size not in (1, 2, 3):
            raise VaultError(f"Taille d'icone inconnue : {size}")
        folder = self.resolve(door_id)
        if not folder.is_dir():
            raise VaultError(f"Cette porte n'existe pas : {door_id}")
        # On n'ecrit que ce qui s'ecarte du reglage naturel de cette apparence.
        naturelle = _taille_naturelle(_icon_of(self.layout.get(door_id)))
        self.layout.set_field(door_id, "icon_size", None if size == naturelle else size)
        parent = Path(door_id).parent.as_posix().strip(".")
        return self._door(folder, parent=parent)

    def _check_icon(self, icon: str) -> None:
        """Une icone doit venir de la reserve, et etre d'un format accepte."""
        prefixe = f"{MEDIAS_DIR}/{ICONS_DIR}/"
        if not icon.startswith(prefixe):
            raise VaultError(f"Une icone doit etre rangee dans {prefixe.rstrip('/')}.")
        if Path(icon).suffix.lower() not in ICON_EXTENSIONS:
            acceptes = ", ".join(sorted(ext.lstrip(".") for ext in ICON_EXTENSIONS))
            raise VaultError(f"Format d'icone non accepte. Formats permis : {acceptes}.")
        if not self.resolve(icon).is_file():
            raise VaultError(f"Cette icone n'existe pas : {icon}")

    def rename(self, item_id: str, new_name: str) -> str:
        source = self.resolve(item_id)
        if not source.exists():
            raise VaultError(f"Introuvable : {item_id}")
        suffix = source.suffix if source.is_file() else ""
        target = _unique(source.parent / (_safe_name(new_name) + suffix))
        source.rename(target)
        new_id = self.relative(target)
        self.layout.rename(item_id, new_id)
        self.layout.rename(GLOBAL + item_id, GLOBAL + new_id)
        self._touch(source)
        self._touch(target)
        self.links.invalidate()
        return new_id

    def folders(self) -> list[Folder]:
        """Tous les dossiers du Vault, pour choisir une destination.

        La racine en tete, puis chaque dossier avec sa profondeur : de quoi
        dessiner une arborescence sans avoir a la recalculer cote interface.
        """
        arbre = [Folder(id="", name=self.name, depth=0)]
        for folder in self._all_folders():
            rel = self.relative(folder)
            arbre.append(Folder(id=rel, name=folder.name, depth=rel.count("/") + 1))
        return arbre

    def move_to(self, item_id: str, destination: str) -> str:
        """Deplace une note ou une porte dans un autre dossier du Vault.

        Le fichier suit, mais aussi tout ce qui lui est attache : sa position,
        son icone, sa vision, le cadrage de la scene qu'il contient, et les
        traits qui le relient. Sans cela, deplacer reviendrait a tout perdre
        sauf le contenu.
        """
        source = self.resolve(item_id)
        if source == self.root:
            raise VaultError("Le Vault lui-meme ne se deplace pas.")
        if not source.exists():
            raise VaultError(f"Introuvable : {item_id}")

        dossier = self.resolve(destination) if destination else self.root
        if not dossier.is_dir():
            raise VaultError(f"Ce dossier n'existe pas : {destination or self.name}")
        if any(part.startswith(".") for part in Path(destination).parts if part):
            raise VaultError("On ne range rien dans un dossier cache.")

        # Un dossier ne peut pas entrer en lui-meme, ni dans ce qu'il contient :
        # il se refermerait sur son propre contenu, qui deviendrait inatteignable.
        if source.is_dir() and (dossier == source or source in dossier.parents):
            raise VaultError("Un dossier ne peut pas etre range dans lui-meme.")
        if dossier == source.parent:
            return item_id  # deja la : rien a faire, et surtout rien a casser

        cible = _unique(dossier / source.name)
        shutil.move(str(source), str(cible))
        new_id = self.relative(cible)

        # La position, l'icone, la vision, le cadrage, les traits : tout suit.
        self.layout.rename(item_id, new_id)
        self.layout.rename(GLOBAL + item_id, GLOBAL + new_id)
        self.layout.rename(CAMERA + item_id, CAMERA + new_id)
        # Sauf la place dans la scene : l'ancienne n'a plus de sens ailleurs, et
        # l'element se poserait par-dessus ce qui s'y trouve deja.
        self.layout.set_field(new_id, "x", None)
        self.layout.set_field(new_id, "y", None)

        self._touch(source)
        self._touch(cible)
        self._touch(source.parent)
        self._touch(dossier)
        self.links.invalidate()
        return new_id

    def delete(self, item_id: str) -> None:
        # Retirer une image posee n'efface aucun fichier : seul le renvoi disparait.
        if item_id.startswith(IMAGE):
            self.layout.forget(item_id)
            return
        target = self.resolve(item_id)
        if target == self.root:
            raise VaultError("Le Vault lui-meme ne peut pas etre supprime.")
        if not target.exists():
            return
        # Rien n'est efface definitivement : tout part dans la corbeille du Vault.
        trash = self.root / VAULT_META_DIR / "trash" / time.strftime("%Y-%m-%d")
        trash.mkdir(parents=True, exist_ok=True)
        shutil.move(str(target), str(_unique(trash / target.name)))
        self.layout.forget(item_id)
        self.layout.forget(GLOBAL + item_id)
        self._touch(target)
        self.links.invalidate()

    # --- Liens et vue d'ensemble ---

    def note_links(self, note_id: str) -> NoteLinks:
        self.resolve(note_id)
        return self.links.links_for(note_id)

    def resolve_link(self, target: str) -> str | None:
        """Note designee par un [[wikilink]], ou None si elle reste a ecrire."""
        return self.links.resolve(target)

    def constellation(self) -> Constellation:
        """Tout le Vault d'un seul coup d'oeil, portes et notes confondues.

        Les positions sont independantes de celles des scenes : ici, chaque porte
        est un noyau autour duquel gravitent ses notes, pour que la vue reste
        lisible meme quand le Vault grossit.
        """
        doors: list[Door] = []
        notes: list[NoteSummary] = []

        for folder in self._all_folders():
            rel = self.relative(folder)
            parent = Path(rel).parent.as_posix().strip(".")
            doors.append(self._door(folder, parent=parent))

        for file in self._all_notes():
            parent = file.parent.resolve().relative_to(self.root).as_posix().strip(".")
            notes.append(self._note_summary(file, parent="" if parent == "." else parent))

        self._place_globally(doors, notes)
        return Constellation(
            doors=doors,
            notes=notes,
            edges=self.links.edges(),
            camera=self.camera(CONSTELLATION_VIEW),
        )

    def _all_folders(self):
        for folder in sorted(self.root.rglob("*"), key=lambda p: p.as_posix().lower()):
            if not folder.is_dir():
                continue
            parts = folder.relative_to(self.root).parts
            if any(part in IGNORED_DIRS or part.startswith(".") for part in parts):
                continue
            yield folder

    def _place_globally(self, doors: list[Door], notes: list[NoteSummary]) -> None:
        """Positionne dans la vue d'ensemble ce qui n'y a jamais ete place."""
        # Chaque porte recoit un noyau sur une spirale large ; la racine est au centre.
        centres: dict[str, tuple[float, float]] = {"": (0.0, 0.0)}
        for rank, door in enumerate(doors, start=1):
            angle = rank * 2.399963  # angle d'or : repartit sans jamais aligner
            radius = 340.0 * math.sqrt(rank)
            centres[door.id] = (math.cos(angle) * radius, math.sin(angle) * radius)

        for door in doors:
            door.position = self._global_position(door.id, *centres[door.id])

        # Les notes gravitent autour du noyau de leur porte.
        per_parent: dict[str, int] = {}
        for note in notes:
            index = per_parent.get(note.parent, 0)
            per_parent[note.parent] = index + 1
            cx, cy = centres.get(note.parent, (0.0, 0.0))
            angle = index * 2.399963
            radius = 96.0 + 34.0 * math.sqrt(index)
            note.position = self._global_position(
                note.id, cx + math.cos(angle) * radius, cy + math.sin(angle) * radius
            )

    def _global_position(self, item_id: str, x: float, y: float) -> Position:
        key = GLOBAL + item_id
        stored = self.layout.position(key)
        if stored:
            return Position(**stored)
        self.layout.set_position(key, round(x, 1), round(y, 1))
        return Position(x=round(x, 1), y=round(y, 1))

    def move_globally(self, item_id: str, x: float, y: float) -> None:
        self.resolve(item_id)
        self.layout.set_position(GLOBAL + item_id, x, y)

    # --- Recherche ---

    def search(self, query: str, limit: int = 50) -> list[NoteSummary]:
        """Recherche plein texte simple sur les titres et le contenu."""
        needle = query.strip().lower()
        if not needle:
            return []
        results: list[tuple[int, NoteSummary]] = []
        for file in self._all_notes():
            try:
                content, meta = md.read(file)
            except OSError:
                continue
            title = md.title_of(file, content, meta)
            score = 0
            if needle in title.lower():
                score += 10
            score += content.lower().count(needle)
            if score:
                parent = file.parent.resolve().relative_to(self.root).as_posix().strip(".")
                results.append((score, self._note_summary(file, parent="" if parent == "" else parent)))
        results.sort(key=lambda pair: pair[0], reverse=True)
        return [summary for _, summary in results[:limit]]

    def _all_notes(self):
        for file in self.root.rglob("*"):
            if not file.is_file() or file.suffix.lower() not in NOTE_EXTENSIONS:
                continue
            parts = file.relative_to(self.root).parts
            if any(part in IGNORED_DIRS or part.startswith(".") for part in parts[:-1]):
                continue
            yield file

    def info(self) -> VaultInfo:
        return VaultInfo(path=str(self.root), name=self.name)


# --- Vault courant (un seul ouvert a la fois) ---

_current: Vault | None = None


def open_vault(path: str) -> Vault:
    global _current
    _current = Vault(Path(path))
    _remember(_current.root)
    return _current


def current_vault() -> Vault:
    if _current is None:
        raise VaultError("Aucun Vault ouvert.")
    return _current


def last_vault() -> str | None:
    """Dernier Vault ouvert, pour le rouvrir au demarrage."""
    settings = app_data_dir() / SETTINGS_FILE
    if not settings.exists():
        return None
    try:
        data = json.loads(settings.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    path = data.get("last_vault")
    return path if isinstance(path, str) and Path(path).is_dir() else None


def _remember(root: Path) -> None:
    settings = app_data_dir() / SETTINGS_FILE
    data: dict = {}
    if settings.exists():
        try:
            data = json.loads(settings.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            data = {}
    data["last_vault"] = str(root)
    settings.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


# --- Utilitaires ---

_FORBIDDEN = set('<>:"/\\|?*')


def _safe_name(name: str) -> str:
    cleaned = "".join(char for char in name if char not in _FORBIDDEN).strip().rstrip(".")
    return cleaned or "Sans titre"


def _unique(path: Path) -> Path:
    """Ajoute « (1) », « (2) »... tant que le chemin est deja pris."""
    if not path.exists():
        return path
    stem, suffix = path.stem, path.suffix
    for index in range(1, 1000):
        candidate = path.with_name(f"{stem} ({index}){suffix}")
        if not candidate.exists():
            return candidate
    return path.with_name(f"{stem} ({int(time.time())}){suffix}")


def _icon_of(stored: dict) -> str:
    """Apparence retenue pour une porte, en se mefiant d'un layout ecrit a la main."""
    icon = stored.get("icon")
    if not isinstance(icon, str) or not icon:
        return "porte"
    if icon in BUILTIN_ICONS:
        return icon
    return icon if icon.startswith(f"{MEDIAS_DIR}/{ICONS_DIR}/") else "porte"


def _taille_naturelle(icon: str) -> int:
    """L'echelle qu'une apparence prend d'elle-meme, faute de choix explicite.

    Le cerveau represente la connaissance et ce qui fait tenir le reste : il
    naît au double de la porte. Tout le reste naît a l'echelle de la porte.
    """
    return 3 if icon == "cerveau" else 1


def _icon_size_of(stored: dict) -> int:
    """Echelle retenue, en se mefiant d'un layout ecrit a la main."""
    brut = stored.get("icon_size")
    if isinstance(brut, bool) or not isinstance(brut, int) or brut not in (1, 2, 3):
        return _taille_naturelle(_icon_of(stored))
    return brut


def _taille(valeur: object) -> int:
    """Une taille vaut 1, 2 ou 3 — jamais autre chose, meme ecrite a la main."""
    try:
        return min(3, max(1, int(valeur)))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 1
