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
      }
    }
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
        if isinstance(data, dict) and isinstance(data.get("items"), dict):
            self._items = data["items"]

    def _save(self) -> None:
        self._file.parent.mkdir(parents=True, exist_ok=True)
        payload = {"version": LAYOUT_VERSION, "items": self._items}
        tmp = self._file.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(self._file)

    # --- API ---

    def get(self, item_id: str) -> dict[str, Any]:
        return self._items.get(item_id, {})

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
            if removed:
                self._save()
