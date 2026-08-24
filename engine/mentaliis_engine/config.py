"""Configuration du moteur."""

from __future__ import annotations

import os
from pathlib import Path

# Le moteur n'ecoute QUE sur la boucle locale : inaccessible depuis le reseau.
HOST = "127.0.0.1"
PORT = int(os.environ.get("MENTALIIS_ENGINE_PORT", "8756"))

# Dossier cache place a la racine de chaque Vault (layout spatial, cache d'index).
VAULT_META_DIR = ".mentaliis"
LAYOUT_FILE = "layout.json"

# Extensions considerees comme des notes.
NOTE_EXTENSIONS = {".md", ".markdown"}

# Dossiers ignores lors du parcours d'un Vault.
IGNORED_DIRS = {".mentaliis", ".git", ".obsidian", "node_modules", "__pycache__", ".trash"}

# Fichier de preferences globales (hors Vault) : dernier vault ouvert, etc.
def app_data_dir() -> Path:
    """Dossier de configuration de l'application, selon la plateforme."""
    if os.name == "nt":
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
    elif os.uname().sysname == "Darwin":  # type: ignore[attr-defined]
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    path = base / "Mentaliis"
    path.mkdir(parents=True, exist_ok=True)
    return path


SETTINGS_FILE = "settings.json"
