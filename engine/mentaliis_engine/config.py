"""Configuration du moteur."""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Le moteur n'ecoute QUE sur la boucle locale : inaccessible depuis le reseau.
HOST = "127.0.0.1"

#: Le moteur livre et celui de developpement n'ecoutent pas au meme endroit.
#: Sans cela, travailler sur Mentaliis pendant que Mentaliis est ouvert fait se
#: disputer le port aux deux moteurs : le second ne peut pas s'attacher, meurt,
#: et son interface se met a parler au premier — donc au Vault de quelqu'un
#: d'autre. Les deux peuvent desormais tourner cote a cote.
PORT_LIVRE = 8756
PORT_DEVELOPPEMENT = 8757
PORT = int(
    os.environ.get(
        "MENTALIIS_ENGINE_PORT",
        str(PORT_LIVRE if getattr(sys, "frozen", False) else PORT_DEVELOPPEMENT),
    )
)

# Dossier cache place a la racine de chaque Vault (layout spatial, cache d'index).
VAULT_META_DIR = ".mentaliis"
LAYOUT_FILE = "layout.json"

# Extensions considerees comme des notes.
NOTE_EXTENSIONS = {".md", ".markdown"}

# Le dossier des medias porte un nom impose : le logiciel ne reconnait que
# celui-la. Il commence par un point pour rester en dehors des portes — c'est
# une reserve, pas un lieu ou l'on entre.
MEDIAS_DIR = ".MEDIAS"

# Les icones personnalisees des portes, dans un sous-dossier lui aussi impose.
ICONS_DIR = ".SVG"

# Seuls formats acceptes pour une icone de porte, dans `.MEDIAS/.SVG`.
# Cette liste-la reste volontairement etroite : une icone doit rester nette.
ICON_EXTENSIONS = {".svg", ".png", ".webp"}

# Images reconnues partout ailleurs, et notamment dans `.MEDIAS`.
IMAGE_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".jfif",
    ".gif",
    ".webp",
    ".avif",
    ".bmp",
    ".svg",
    ".tif",
    ".tiff",
    ".ico",
    ".heic",
    ".heif",
}

# Ce que la reserve sait presenter, par famille.
VIDEO_EXTENSIONS = {".mp4", ".webm", ".ogv", ".mov", ".mkv"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".opus"}
DOCUMENT_EXTENSIONS = {".pdf", ".txt", ".csv", ".json", ".zip", ".docx", ".xlsx", ".pptx"}

# Dossiers ignores lors du parcours d'un Vault.
IGNORED_DIRS = {".mentaliis", ".git", ".obsidian", "node_modules", "__pycache__", ".trash"}

# Fichier de preferences globales (hors Vault) : dernier vault ouvert, etc.
def app_data_dir() -> Path:
    """Dossier de configuration de l'application, selon la plateforme.

    Le moteur de developpement et le moteur installe ne partagent pas ce
    dossier. Sans cette separation, ouvrir un Vault de test remplacerait le
    souvenir du dernier Vault de celui qui travaille : au prochain demarrage,
    l'application installee ouvrirait le Vault de demonstration a la place du
    sien. On distingue les deux sur ce qui les distingue vraiment — l'un est
    fige par PyInstaller, l'autre non.
    """
    if os.name == "nt":
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
    elif os.uname().sysname == "Darwin":  # type: ignore[attr-defined]
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))

    # Une variable d'environnement l'emporte : les tests s'isolent ainsi
    # completement, sans toucher ni a l'un ni a l'autre.
    force = os.environ.get("MENTALIIS_CONFIG_DIR")
    if force:
        path = Path(force)
    else:
        path = base / ("Mentaliis" if getattr(sys, "frozen", False) else "Mentaliis (dev)")
    path.mkdir(parents=True, exist_ok=True)
    return path


SETTINGS_FILE = "settings.json"
