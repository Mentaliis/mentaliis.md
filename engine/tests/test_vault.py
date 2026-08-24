"""Tests du Vault."""

from __future__ import annotations

import pytest

from mentaliis_engine.vault import Vault, VaultError


@pytest.fixture()
def vault(tmp_path):
    (tmp_path / "Projets").mkdir()
    (tmp_path / "Projets" / "idee.md").write_text("# Une idee\n\nDu texte. #vision\n", "utf-8")
    (tmp_path / "journal.md").write_text("---\ntitle: Mon journal\n---\n\nContenu.\n", "utf-8")
    return Vault(tmp_path)


def test_scene_racine_liste_portes_et_notes(vault):
    scene = vault.scene("")
    assert [door.name for door in scene.doors] == ["Projets"]
    assert [note.title for note in scene.notes] == ["Mon journal"]


def test_titre_vient_du_frontmatter_puis_du_h1(vault):
    scene = vault.scene("Projets")
    assert scene.notes[0].title == "Une idee"


def test_tags_extraits_du_corps(vault):
    scene = vault.scene("Projets")
    assert "vision" in scene.notes[0].tags


def test_les_positions_sont_persistees(vault):
    vault.move("Projets", 120, -40)
    assert vault.scene("").doors[0].position.x == 120


def test_les_positions_survivent_a_une_reouverture_du_logiciel(tmp_path, vault):
    vault.move("Projets", 321.5, -120.5)
    vault.move("journal.md", -80, 240)

    # Un nouveau Vault sur le meme dossier : c'est ce que fait le logiciel au
    # demarrage suivant, une fois le moteur redemarre.
    rouvert = Vault(tmp_path)
    scene = rouvert.scene("")
    porte = next(item for item in scene.doors if item.id == "Projets")
    note = next(item for item in scene.notes if item.id == "journal.md")

    assert (porte.position.x, porte.position.y) == (321.5, -120.5)
    assert (note.position.x, note.position.y) == (-80, 240)


def test_une_position_deja_choisie_nest_jamais_recalculee(tmp_path, vault):
    vault.move("Projets", 7, 7)
    for _ in range(3):
        Vault(tmp_path).scene("")
    assert Vault(tmp_path).layout.position("Projets") == {"x": 7.0, "y": 7.0}


def test_nouveaux_elements_ne_sont_pas_empiles(vault):
    scene = vault.scene("")
    positions = {(item.position.x, item.position.y) for item in [*scene.doors, *scene.notes]}
    assert len(positions) == len(scene.doors) + len(scene.notes)


def test_ecriture_et_relecture_dune_note(vault):
    vault.write_note("journal.md", "# Nouveau\n\nAutre contenu.\n")
    assert "Autre contenu." in vault.read_note("journal.md").content


def test_ecriture_preserve_le_frontmatter(vault):
    vault.write_note("journal.md", "Contenu revise.\n")
    assert vault.read_note("journal.md").frontmatter["title"] == "Mon journal"


def test_creation_de_note_et_de_porte(vault):
    door = vault.create_door("", "Vie")
    note = vault.create_note(door.id, "Objectifs")
    assert (vault.root / "Vie" / "Objectifs.md").is_file()
    assert note.parent == "Vie"


def test_renommer_conserve_la_position(vault):
    vault.move("Projets", 50, 60)
    new_id = vault.rename("Projets", "Projets 2026")
    assert vault.layout.position(new_id) == {"x": 50.0, "y": 60.0}


def test_suppression_passe_par_la_corbeille(vault):
    vault.delete("journal.md")
    assert not (vault.root / "journal.md").exists()
    assert list((vault.root / ".mentaliis" / "trash").rglob("journal.md"))


def test_impossible_de_sortir_du_vault(vault):
    with pytest.raises(VaultError):
        vault.resolve("../../secret.md")


def test_recherche_plein_texte(vault):
    assert [note.id for note in vault.search("idee")] == ["Projets/idee.md"]
