"""Point d'entree du moteur.

Lance un serveur HTTP local, joignable uniquement depuis cette machine.
L'interface Tauri le demarre en arriere-plan et l'arrete en meme temps qu'elle.
"""

from __future__ import annotations

import contextlib
import logging
from collections.abc import AsyncIterator

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .api import router
from .config import HOST, PORT
from .vault import open_vault
from .vault.vault import last_vault
from .watcher import watcher

log = logging.getLogger("mentaliis")


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Rouvre le dernier Vault, et surveille le disque tant que l'application vit.

    Sans cela, chaque demarrage renverrait l'utilisateur a l'ecran de choix du
    Vault, alors qu'il en a deja un et veut le retrouver tel qu'il l'a laisse.
    """
    remembered = last_vault()
    if remembered:
        try:
            vault = open_vault(remembered)
            await watcher.watch(vault)
            log.info("Vault rouvert : %s", vault.root)
        except Exception as error:  # le dossier a pu etre deplace ou supprime
            log.warning("Impossible de rouvrir %s : %s", remembered, error)

    yield

    await watcher.stop()


app = FastAPI(
    title="Mentaliis Engine",
    version=__version__,
    description="Moteur local de Mentaliis. Aucune donnee ne quitte la machine.",
    lifespan=lifespan,
)

# L'interface n'a pas la meme adresse selon la facon dont on l'ouvre :
#   - en developpement, Vite la sert sur http://localhost:1420 ;
#   - une fois empaquetee, la fenetre native la sert depuis http://tauri.localhost
#     sous Windows, et depuis tauri://localhost sur macOS et Linux.
# Les trois doivent etre reconnues, sans jamais ouvrir la porte a l'exterieur.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=(
        r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?"
        r"|https?://tauri\.localhost"
        r"|tauri://localhost)$"
    ),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


def run() -> None:
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")


if __name__ == "__main__":
    run()
