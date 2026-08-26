"""Porte d'entree du moteur fige.

PyInstaller lance un *fichier*, pas un module : appeler directement
`mentaliis_engine/main.py` le priverait de son paquet parent, et tous ses
imports relatifs (`from .config import ...`) echoueraient au demarrage.
Ce petit fichier importe le paquet dans les regles, puis lui passe la main.

Il ne sert qu'a l'empaquetage. En developpement, la coquille Rust appelle
toujours `python -m mentaliis_engine.main`, comme avant.
"""

from mentaliis_engine.main import run

if __name__ == "__main__":
    run()
