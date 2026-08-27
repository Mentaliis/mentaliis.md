"""Le moteur ne survit pas a l'application qui l'a lance.

Un moteur reste ordinairement arrete par la coquille Rust. Mais celle-ci peut
disparaitre sans lui en laisser le temps : une panne, un arret force, ou une
mise a jour qui remplace l'application. Le moteur continuerait alors de tourner
seul, gardant le port 8756 et ses propres fichiers ouverts — de quoi empecher
le prochain demarrage, ou l'installation d'une nouvelle version.

Il surveille donc le processus qui l'a lance, et s'en va avec lui.
"""

from __future__ import annotations

import ctypes
import logging
import os
import sys
import threading
import time

log = logging.getLogger("mentaliis")

#: La coquille Rust inscrit son propre numero de processus ici avant de lancer
#: le moteur. Absent, c'est qu'on lance le moteur a la main : pas de surveillance.
VARIABLE = "MENTALIIS_PARENT_PID"

#: Windows rend ce code tant que le processus tourne encore.
_TOUJOURS_ACTIF = 259
_DROIT_DE_LECTURE = 0x1000  # PROCESS_QUERY_LIMITED_INFORMATION


def vivant(pid: int) -> bool:
    """Ce processus tourne-t-il encore ?"""
    if pid <= 0:
        return False
    if sys.platform == "win32":
        noyau = ctypes.windll.kernel32
        poignee = noyau.OpenProcess(_DROIT_DE_LECTURE, False, pid)
        if not poignee:
            return False
        try:
            code = ctypes.c_ulong()
            # Un processus termine garde un objet tant qu'une poignee existe :
            # sa seule presence ne prouve rien, c'est son code de sortie qui parle.
            if not noyau.GetExitCodeProcess(poignee, ctypes.byref(code)):
                return False
            return code.value == _TOUJOURS_ACTIF
        finally:
            noyau.CloseHandle(poignee)
    try:
        os.kill(pid, 0)
    except (OSError, ProcessLookupError):
        return False
    return True


def surveiller(intervalle: float = 2.0) -> None:
    """Met fin au moteur des que l'application qui l'a lance a disparu."""
    brut = os.environ.get(VARIABLE)
    if not brut:
        return
    try:
        parent = int(brut)
    except ValueError:
        log.warning("%s illisible : %r", VARIABLE, brut)
        return
    if not vivant(parent):
        return

    def veille() -> None:
        while vivant(parent):
            time.sleep(intervalle)
        log.info("L'application a disparu : le moteur s'arrete.")
        # Une sortie franche : il n'y a plus personne pour attendre un arret
        # ordonne, et les fichiers doivent etre relaches tout de suite.
        os._exit(0)

    threading.Thread(target=veille, name="surveillance-parent", daemon=True).start()
