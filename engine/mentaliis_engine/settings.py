"""Preferences de l'utilisateur.

Elles ne vivent pas dans le Vault : changer de Vault ne doit pas changer la
taille de l'interface. Elles sont donc rangees avec la configuration de
l'application, a cote du souvenir du dernier Vault ouvert.
"""

from __future__ import annotations

import json
import threading

from .config import SETTINGS_FILE, app_data_dir
from .models import Settings

_lock = threading.Lock()


def _file():
    return app_data_dir() / SETTINGS_FILE


def _read_all() -> dict:
    path = _file()
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        # Un fichier abime ne doit jamais empecher l'application de demarrer :
        # on repart des valeurs par defaut.
        return {}
    return data if isinstance(data, dict) else {}


def load() -> Settings:
    data = _read_all()
    try:
        return Settings(**{key: data[key] for key in Settings.model_fields if key in data})
    except Exception:
        return Settings()


def save(settings: Settings) -> Settings:
    with _lock:
        # On relit avant d'ecrire : le fichier contient aussi le dernier Vault.
        data = _read_all()
        data.update(settings.model_dump())
        _file().write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return settings
