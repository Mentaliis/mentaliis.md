"""Le moteur doit s'en aller avec l'application qui l'a lance.

Un moteur orphelin garde le port 8756 et ses propres fichiers ouverts : de quoi
empecher le prochain demarrage, et faire echouer l'installation d'une mise a
jour qui cherche a remplacer ces fichiers.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time

from mentaliis_engine import parent


def test_le_processus_courant_est_vivant():
    assert parent.vivant(os.getpid())


def test_un_processus_disparu_ne_l_est_plus():
    enfant = subprocess.Popen([sys.executable, "-c", "pass"])
    enfant.wait()
    # Windows garde un objet processus tant qu'une poignee existe : c'est le
    # code de sortie qui doit trancher, pas la simple existence de l'objet.
    for _ in range(20):
        if not parent.vivant(enfant.pid):
            break
        time.sleep(0.05)
    assert not parent.vivant(enfant.pid)


def test_un_numero_absurde_n_est_pas_vivant():
    assert not parent.vivant(0)
    assert not parent.vivant(-1)


def test_sans_la_variable_aucune_surveillance(monkeypatch):
    monkeypatch.delenv(parent.VARIABLE, raising=False)
    # Lance a la main, en developpement : le moteur ne surveille personne.
    parent.surveiller()


def test_une_variable_illisible_ne_fait_pas_tomber_le_moteur(monkeypatch):
    monkeypatch.setenv(parent.VARIABLE, "pas-un-nombre")
    parent.surveiller()


def test_le_moteur_s_arrete_quand_son_parent_disparait(monkeypatch):
    """La surveillance elle-meme, sans tuer le processus de test."""
    faux = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
    monkeypatch.setenv(parent.VARIABLE, str(faux.pid))

    sorties: list[int] = []
    monkeypatch.setattr(parent.os, "_exit", sorties.append)

    parent.surveiller(intervalle=0.05)
    assert not sorties, "le parent est vivant : rien ne doit se produire"

    faux.terminate()
    faux.wait()
    for _ in range(60):
        if sorties:
            break
        time.sleep(0.05)
    assert sorties == [0], "le moteur devait s'arreter avec son parent"
