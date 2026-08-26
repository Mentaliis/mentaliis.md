"""Tests des traits tires a la main entre elements d'une scene."""

from __future__ import annotations

import pytest

from mentaliis_engine.vault import Vault


@pytest.fixture()
def vault(tmp_path):
    (tmp_path / "Projets").mkdir()
    (tmp_path / "Vision").mkdir()
    (tmp_path / "Sante").mkdir()
    (tmp_path / "journal.md").write_text("# Journal\n", "utf-8")
    (tmp_path / "Projets" / "idee.md").write_text("# Idee\n", "utf-8")
    return Vault(tmp_path)


def liens(vault, path=""):
    return {(link.source, link.target) for link in vault.scene(path).links}


# --- Attacher ---


def test_aucun_trait_au_depart(vault):
    assert liens(vault) == set()


def test_attacher_deux_portes(vault):
    vault.link("Projets", "Vision")
    assert liens(vault) == {("Projets", "Vision")}


def test_un_trait_na_pas_de_sens(vault):
    # Relier A a B, c'est la meme chose que relier B a A.
    vault.link("Vision", "Projets")
    assert liens(vault) == {("Projets", "Vision")}


def test_attacher_deux_fois_ne_cree_quun_trait(vault):
    vault.link("Projets", "Vision")
    vault.link("Vision", "Projets")
    assert len(vault.scene("").links) == 1


def test_on_peut_relier_une_porte_a_une_note(vault):
    vault.link("Projets", "journal.md")
    assert liens(vault) == {("Projets", "journal.md")}


def test_un_element_ne_se_relie_pas_a_lui_meme(vault):
    with pytest.raises(Exception):
        vault.link("Projets", "Projets")


def test_un_element_inexistant_est_refuse(vault):
    with pytest.raises(Exception):
        vault.link("Projets", "Fantome")


def test_deux_scenes_differentes_ne_se_relient_pas(vault):
    with pytest.raises(Exception):
        vault.link("Projets", "Projets/idee.md")


# --- Detacher ---


def test_detacher(vault):
    vault.link("Projets", "Vision")
    vault.unlink("Projets", "Vision")
    assert liens(vault) == set()


def test_detacher_dans_lautre_sens_marche_aussi(vault):
    vault.link("Projets", "Vision")
    vault.unlink("Vision", "Projets")
    assert liens(vault) == set()


def test_detacher_ce_qui_ne_l_est_pas_ne_fait_rien(vault):
    vault.unlink("Projets", "Vision")
    assert liens(vault) == set()


# --- Ce que la scene renvoie ---


def test_une_scene_ne_montre_que_ses_propres_traits(vault):
    vault.link("Projets", "Vision")
    assert liens(vault, "Projets") == set()


def test_les_traits_survivent_a_une_reouverture(tmp_path, vault):
    vault.link("Projets", "Vision")
    vault.link("Sante", "journal.md")
    rouvert = Vault(tmp_path)
    assert liens(rouvert) == {("Projets", "Vision"), ("Sante", "journal.md")}


# --- Ce qui bouge sous les traits ---


def test_un_trait_suit_un_renommage(vault):
    vault.link("Projets", "Vision")
    vault.rename("Projets", "Chantiers")
    assert liens(vault) == {("Chantiers", "Vision")}


def test_un_trait_disparait_avec_ce_quil_reliait(vault):
    vault.link("Projets", "Vision")
    vault.delete("Vision")
    assert liens(vault) == set()
    assert vault.layout.links() == []


def test_supprimer_une_porte_emporte_les_traits_de_son_contenu(vault):
    (vault.root / "Vision" / "a.md").write_text("# A\n", "utf-8")
    (vault.root / "Vision" / "b.md").write_text("# B\n", "utf-8")
    vault.link("Vision/a.md", "Vision/b.md")
    vault.delete("Vision")
    assert vault.layout.links() == []


def test_deplacer_un_element_ne_casse_pas_son_trait(vault):
    vault.link("Projets", "Vision")
    vault.move("Projets", 300, -120)
    assert liens(vault) == {("Projets", "Vision")}
