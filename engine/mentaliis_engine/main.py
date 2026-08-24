"""Point d'entree du moteur.

Lance un serveur HTTP local, joignable uniquement depuis cette machine.
L'interface Tauri le demarre en arriere-plan et l'arrete en meme temps qu'elle.
"""

from __future__ import annotations

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .api import router
from .config import HOST, PORT

app = FastAPI(
    title="Mentaliis Engine",
    version=__version__,
    description="Moteur local de Mentaliis. Aucune donnee ne quitte la machine.",
)

# En developpement, l'interface est servie par Vite sur un autre port :
# on autorise donc les origines locales uniquement.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?|tauri://localhost)$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


def run() -> None:
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")


if __name__ == "__main__":
    run()
