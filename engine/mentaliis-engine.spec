# -*- mode: python ; coding: utf-8 -*-
"""Recette d'empaquetage du moteur.

PyInstaller lit le code, y joint l'interpreteur Python et les bibliotheques,
et produit un dossier autonome : la machine qui recoit Mentaliis n'a pas besoin
d'avoir Python installe.

On construit en `--onedir` : un dossier plutot qu'un fichier unique. Le fichier
unique se decompresse dans un dossier temporaire a chaque lancement, ce qui
coute une a deux secondes au demarrage et attire l'attention des antivirus.
Le dossier, lui, demarre tout de suite.

Construire :  python -m PyInstaller --noconfirm mentaliis-engine.spec
"""

from PyInstaller.utils.hooks import collect_submodules

# uvicorn choisit ses modules par leur nom au moment de tourner (boucle
# d'evenements, protocole HTTP, cycle de vie). PyInstaller ne peut pas le
# deviner en lisant le code : il faut les lui nommer, sinon le moteur se
# construit sans erreur et s'effondre au premier demarrage.
hiddenimports = [
    *collect_submodules("uvicorn"),
    *collect_submodules("watchfiles"),
    *collect_submodules("mentaliis_engine"),
    "anyio._backends._asyncio",
]

# Rien de tout cela ne sert au moteur, et chaque exclusion allege le dossier.
excludes = [
    "tkinter",
    "pytest",
    "IPython",
    "matplotlib",
    "numpy",
    "PIL",
    "PySide6",
    "PyQt5",
]

analyse = Analysis(
    ["launcher.py"],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
    optimize=0,
)

pyz = PYZ(analyse.pure)

executable = EXE(
    pyz,
    analyse.scripts,
    [],
    exclude_binaries=True,
    name="mentaliis-engine",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    # `console=True` a dessein : sans console, un programme fige n'a plus de
    # sortie standard, et l'enregistrement des messages d'uvicorn s'y brise.
    # La coquille Rust lance de toute facon le moteur avec CREATE_NO_WINDOW,
    # donc aucune fenetre noire n'apparait a cote de Mentaliis.
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

collection = COLLECT(
    executable,
    analyse.binaries,
    analyse.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="mentaliis-engine",
)
