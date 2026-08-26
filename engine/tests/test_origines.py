"""L'interface doit etre reconnue quelle que soit la facon dont on l'ouvre.

Une fois empaquetee, la fenetre native ne sert plus l'interface depuis
`localhost:1420` mais depuis une adresse propre a chaque systeme. Si le moteur
ne la reconnait pas, le navigateur bloque tous les appels : l'application
s'ouvre sur un ecran vide, et rien de tout cela ne se voit en developpement.
"""

from __future__ import annotations

import re

import pytest

from mentaliis_engine.main import app


def motif() -> re.Pattern[str]:
    """La regle d'origines telle que le middleware CORS l'applique."""
    for couche in app.user_middleware:
        regex = couche.kwargs.get("allow_origin_regex")
        if regex:
            return re.compile(regex)
    raise AssertionError("aucune regle d'origines n'est posee")


@pytest.mark.parametrize(
    "origine",
    [
        "http://localhost:1420",  # Vite, en developpement
        "http://127.0.0.1:1420",
        "http://tauri.localhost",  # fenetre empaquetee, Windows
        "https://tauri.localhost",
        "tauri://localhost",  # fenetre empaquetee, macOS et Linux
    ],
)
def test_les_origines_de_l_application_sont_reconnues(origine):
    assert motif().fullmatch(origine), origine


@pytest.mark.parametrize(
    "origine",
    [
        "http://exemple.com",
        "https://tauri.localhost.exemple.com",
        "http://localhost.exemple.com",
        "http://192.168.1.20:1420",
    ],
)
def test_le_reste_du_monde_reste_dehors(origine):
    assert not motif().fullmatch(origine), origine
