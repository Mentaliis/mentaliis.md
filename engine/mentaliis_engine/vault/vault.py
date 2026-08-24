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

from ..config import (
    IGNORED_DIRS,
    NOTE_EXTENSIONS,
    SETTINGS_FILE,
    VAULT_META_DIR,
    app_data_dir,
)
from ..models import (
    AttachedImage,
    Constellation,
    Door,
    Note,
    NoteLinks,
    NoteSummary,
    Position,
    SceneResponse,
    VaultInfo,
)
from . import markdown as md
from .layout import Layout

#: Prefixe des positions de la vue constellation. Un element a deux places :
#: une dans sa scene, une dans la vue d'ensemble — elles n'ont rien a voir.
GLOBAL = "@constellation/"

#: Dossier ou atterrissent les images deposees dans l'application.
ASSETS_DIR = "Assets"

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".avif"}


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

        # Import tardif : l'index a besoin du type Vault, defini ici.
        from ..index import LinkIndex

        self.links = LinkIndex(self)

        #: Ecritures faites par l'application elle-meme, pour que la surveillance
        #: du disque ne les renvoie pas a l'interface comme des changements externes.
        self._own_writes: dict[str, float] = {}

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

        self._auto_place(doors, notes)
        return SceneResponse(
            path=path,
            name=self.name if not path else folder.name,
            doors=doors,
            notes=notes,
        )

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
        radius_step = 210.0
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
        file = folder / f"{_safe_name(title)}.md"
        file = _unique(file)
        md.write(file, f"# {title}\n\n")
        self._touch(file)
        self.links.invalidate()
        return self._note_summary(file, parent=parent)

    def set_images(self, note_id: str, images: list[AttachedImage]) -> NoteSummary:
        """Remplace les images accrochees autour d'une note."""
        file = self.resolve(note_id)
        if not file.is_file():
            raise VaultError(f"Cette note n'existe pas : {note_id}")
        for image in images:
            self.resolve(image.path)  # chaque image doit vivre dans le Vault
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
        return self.relative(target)

    # --- Operations communes ---

    def move(self, item_id: str, x: float, y: float) -> None:
        self.resolve(item_id)  # valide que la cible est bien dans le Vault
        self.layout.set_position(item_id, x, y)

    def set_cover(self, door_id: str, cover: str | None) -> Door:
        folder = self.resolve(door_id)
        if not folder.is_dir():
            raise VaultError(f"Cette porte n'existe pas : {door_id}")
        if cover:
            self.resolve(cover)  # la couverture doit vivre dans le Vault
        self.layout.set_field(door_id, "cover", cover)
        parent = Path(door_id).parent.as_posix().strip(".")
        return self._door(folder, parent=parent)

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

    def delete(self, item_id: str) -> None:
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
        return Constellation(doors=doors, notes=notes, edges=self.links.edges())

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
    """Ajoute un suffixe numerique tant que le chemin est deja pris."""
    if not path.exists():
        return path
    stem, suffix = path.stem, path.suffix
    for index in range(2, 1000):
        candidate = path.with_name(f"{stem} {index}{suffix}")
        if not candidate.exists():
            return candidate
    return path.with_name(f"{stem} {int(time.time())}{suffix}")
