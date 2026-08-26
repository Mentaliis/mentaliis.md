"""Persistance du layout spatial.

Les positions des portes et des notes ne vivent pas dans les fichiers markdown :
elles sont stockees a part, dans `<vault>/.mentaliis/layout.json`. Un Vault reste
donc lisible par n'importe quel autre editeur markdown, et supprimer ce fichier ne
fait perdre que la disposition visuelle, jamais le contenu.

Format :

    {
      "version": 1,
      "items": {
        "Projets": {"x": 120, "y": -40, "cover": "Assets/projets.jpg"},
        "Projets/idee.md": {"x": 300, "y": 80, "images": [...]}
      },
      "links": [["Projets", "Vision"]]
    }

Les liens sont des paires non orientees : relier A a B, c'est la meme chose que
relier B a A. On les range donc toujours dans le meme ordre, ce qui evite les
doublons sans avoir a chercher.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

from ..config import LAYOUT_FILE, VAULT_META_DIR

LAYOUT_VERSION = 1


class Layout:
    """Lit et ecrit les positions spatiales d'un Vault."""

    def __init__(self, vault_root: Path) -> None:
        self._root = vault_root
        self._file = vault_root / VAULT_META_DIR / LAYOUT_FILE
        self._lock = threading.Lock()
        self._items: dict[str, dict[str, Any]] = {}
        self._links: set[tuple[str, str]] = set()
        self._load()

    # --- Lecture / ecriture disque ---

    def _load(self) -> None:
        if not self._file.exists():
            return
        try:
            data = json.loads(self._file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            # Un layout corrompu ne doit jamais empecher d'ouvrir le Vault :
            # on repart d'une disposition vide, le contenu reste intact.
            return
        if not isinstance(data, dict):
            return
        if isinstance(data.get("items"), dict):
            self._items = data["items"]
        for pair in data.get("links") or []:
            if isinstance(pair, list) and len(pair) == 2 and all(isinstance(x, str) for x in pair):
                self._links.add(_pair(pair[0], pair[1]))

    def _save(self) -> None:
        self._file.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": LAYOUT_VERSION,
            "items": self._items,
            "links": [list(pair) for pair in sorted(self._links)],
        }
        tmp = self._file.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(self._file)

    # --- API ---

    def get(self, item_id: str) -> dict[str, Any]:
        return self._items.get(item_id, {})

    def entries(self, prefix: str) -> list[tuple[str, dict[str, Any]]]:
        """Toutes les entrees dont la cle commence ainsi, dans l'ordre de lecture."""
        return [(key, value) for key, value in self._items.items() if key.startswith(prefix)]

    def position(self, item_id: str) -> dict[str, float] | None:
        entry = self._items.get(item_id)
        if entry and "x" in entry and "y" in entry:
            return {"x": float(entry["x"]), "y": float(entry["y"])}
        return None

    def set_position(self, item_id: str, x: float, y: float) -> None:
        with self._lock:
            entry = self._items.setdefault(item_id, {})
            entry["x"] = x
            entry["y"] = y
            self._save()

    def set_field(self, item_id: str, key: str, value: Any) -> None:
        with self._lock:
            entry = self._items.setdefault(item_id, {})
            if value is None:
                entry.pop(key, None)
            else:
                entry[key] = value
            self._save()

    # --- Liens ---

    def links(self) -> list[tuple[str, str]]:
        return sorted(self._links)

    def link(self, source: str, target: str) -> None:
        with self._lock:
            self._links.add(_pair(source, target))
            self._save()

    def unlink(self, source: str, target: str) -> None:
        with self._lock:
            self._links.discard(_pair(source, target))
            self._save()

    def linked(self, source: str, target: str) -> bool:
        return _pair(source, target) in self._links

    def rename(self, old_id: str, new_id: str) -> None:
        """Suit un element renomme ou deplace pour qu'il garde sa position."""
        with self._lock:
            changed = False
            for key in list(self._items):
                if key == old_id:
                    self._items[new_id] = self._items.pop(key)
                    changed = True
                elif key.startswith(old_id + "/"):
                    suffix = key[len(old_id) :]
                    self._items[new_id + suffix] = self._items.pop(key)
                    changed = True

            # Un lien doit survivre au renommage de ce qu'il relie.
            renames = {
                pair: _pair(_moved(pair[0], old_id, new_id), _moved(pair[1], old_id, new_id))
                for pair in self._links
            }
            if any(before != after for before, after in renames.items()):
                self._links = set(renames.values())
                changed = True

            if changed:
                self._save()

    def forget(self, item_id: str) -> None:
        """Oublie un element supprime, ainsi que tout ce qu'il contenait."""
        with self._lock:
            removed = False
            for key in list(self._items):
                if key == item_id or key.startswith(item_id + "/"):
                    del self._items[key]
                    removed = True

            # Un lien vers ce qui n'existe plus n'a pas de sens.
            restants = {pair for pair in self._links if not any(_under(x, item_id) for x in pair)}
            if restants != self._links:
                self._links = restants
                removed = True

            if removed:
                self._save()


def _pair(a: str, b: str) -> tuple[str, str]:
    """Un lien n'a pas de sens : on range toujours ses deux bouts pareil."""
    return (a, b) if a <= b else (b, a)


def _under(item_id: str, ancestor: str) -> bool:
    return item_id == ancestor or item_id.startswith(ancestor + "/")


def _moved(item_id: str, old_id: str, new_id: str) -> str:
    if item_id == old_id:
        return new_id
    if item_id.startswith(old_id + "/"):
        return new_id + item_id[len(old_id) :]
    return item_id
