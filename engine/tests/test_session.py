"""Rouvrir Mentaliis doit reprendre exactement la ou l'on etait.

Revenir au centre du Vault a chaque lancement, c'est recommencer la visite
alors qu'on rentre chez soi.
"""

from __future__ import annotations

from mentaliis_engine.models import Session
from mentaliis_engine.vault.vault import Vault


def vault_de_test(tmp_path) -> Vault:
    (tmp_path / "Projets").mkdir()
    (tmp_path / "Projets" / "plan.md").write_text("# Plan" + chr(10), encoding="utf-8")
    (tmp_path / "Projets" / "notes.md").write_text("# Notes" + chr(10), encoding="utf-8")
    return Vault(tmp_path)


def test_un_vault_neuf_ouvre_a_la_racine(tmp_path):
    session = vault_de_test(tmp_path).session()
    assert session.path == ""
    assert session.tabs == []
    assert session.active is None


def test_l_endroit_est_retenu(tmp_path):
    vault = vault_de_test(tmp_path)
    vault.set_session(Session(path="Projets", tabs=["Projets/plan.md"], active="Projets/plan.md"))

    # Et il survit a une relecture complete du Vault.
    relu = Vault(tmp_path).session()
    assert relu.path == "Projets"
    assert relu.tabs == ["Projets/plan.md"]
    assert relu.active == "Projets/plan.md"


def test_plusieurs_onglets_gardent_leur_ordre(tmp_path):
    vault = vault_de_test(tmp_path)
    onglets = ["Projets/notes.md", "Projets/plan.md"]
    vault.set_session(Session(path="Projets", tabs=onglets, active="Projets/notes.md"))
    assert Vault(tmp_path).session().tabs == onglets


def test_revenir_a_la_racine_s_enregistre_aussi(tmp_path):
    vault = vault_de_test(tmp_path)
    vault.set_session(Session(path="Projets", tabs=["Projets/plan.md"]))
    vault.set_session(Session(path="", tabs=[]))
    relu = Vault(tmp_path).session()
    assert relu.path == ""
    assert relu.tabs == []


def test_un_fichier_abime_ne_fait_pas_tomber_l_ouverture(tmp_path):
    vault = vault_de_test(tmp_path)
    vault.layout.set_field("@session", "path", 42)
    vault.layout.set_field("@session", "tabs", "pas une liste")
    session = Vault(tmp_path).session()
    assert session.path == ""
    assert session.tabs == []
