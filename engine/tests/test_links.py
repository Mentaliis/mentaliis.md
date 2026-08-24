"""Tests du reseau de liens et de la vue d'ensemble."""

from __future__ import annotations

import pytest

from mentaliis_engine.models import AttachedImage, Position
from mentaliis_engine.vault import Vault


@pytest.fixture()
def vault(tmp_path):
    (tmp_path / "Projets").mkdir()
    (tmp_path / "Vision").mkdir()
    (tmp_path / "Vision" / "Cap 2030.md").write_text(
        "---\ntitle: Cap 2030\n---\n\nOu je vais. Voir [[Mentaliis]].\n", "utf-8"
    )
    (tmp_path / "Projets" / "Mentaliis.md").write_text(
        "# Mentaliis\n\nRelie a [[Cap 2030]] et a [[Note jamais ecrite]].\n", "utf-8"
    )
    (tmp_path / "orpheline.md").write_text("# Orpheline\n\nPersonne ne me cite.\n", "utf-8")
    return Vault(tmp_path)


# --- Liens ---


def test_liens_sortants_resolus(vault):
    links = vault.note_links("Projets/Mentaliis.md")
    assert [ref.id for ref in links.outgoing] == ["Vision/Cap 2030.md"]


def test_backlinks(vault):
    links = vault.note_links("Vision/Cap 2030.md")
    assert [ref.id for ref in links.backlinks] == ["Projets/Mentaliis.md"]


def test_lien_vers_note_inexistante_reste_signale(vault):
    assert vault.note_links("Projets/Mentaliis.md").unresolved == ["Note jamais ecrite"]


def test_lien_resolu_par_le_titre_du_frontmatter(vault):
    # "Cap 2030" est ici a la fois le nom de fichier et le titre.
    assert vault.resolve_link("cap 2030") == "Vision/Cap 2030.md"


def test_lien_resolu_par_le_chemin_complet(vault):
    assert vault.resolve_link("Projets/Mentaliis") == "Projets/Mentaliis.md"


def test_note_sans_lien_na_pas_de_voisin(vault):
    links = vault.note_links("orpheline.md")
    assert not links.outgoing and not links.backlinks


def test_index_se_met_a_jour_apres_ecriture(vault):
    assert not vault.note_links("orpheline.md").backlinks
    vault.write_note("Projets/Mentaliis.md", "Et aussi [[orpheline]].\n")
    assert [ref.id for ref in vault.note_links("orpheline.md").backlinks] == [
        "Projets/Mentaliis.md"
    ]


def test_un_lien_survit_au_renommage_du_fichier(vault):
    # La note garde `title: Cap 2030` dans son frontmatter : le lien ecrit
    # continue donc de la trouver, sous son nouveau nom de fichier.
    vault.rename("Vision/Cap 2030.md", "Cap 2040")
    assert [ref.id for ref in vault.note_links("Projets/Mentaliis.md").outgoing] == [
        "Vision/Cap 2040.md"
    ]


def test_un_lien_casse_par_une_suppression_est_signale(vault):
    vault.delete("Vision/Cap 2030.md")
    assert vault.note_links("Projets/Mentaliis.md").unresolved == [
        "Cap 2030",
        "Note jamais ecrite",
    ]


# --- Constellation ---


def test_constellation_contient_tout_le_vault(vault):
    view = vault.constellation()
    assert {door.id for door in view.doors} == {"Projets", "Vision"}
    assert len(view.notes) == 3


def test_constellation_expose_les_liaisons(vault):
    edges = vault.constellation().edges
    assert len(edges) == 1
    assert {edges[0].source, edges[0].target} == {
        "Projets/Mentaliis.md",
        "Vision/Cap 2030.md",
    }


def test_constellation_ne_superpose_rien(vault):
    view = vault.constellation()
    positions = [(item.position.x, item.position.y) for item in [*view.doors, *view.notes]]
    assert len(set(positions)) == len(positions)


def test_position_globale_independante_de_la_scene(vault):
    vault.move("Projets", 10, 10)
    vault.move_globally("Projets", 999, -999)
    assert vault.scene("").doors[0].position.x == 10
    door = next(item for item in vault.constellation().doors if item.id == "Projets")
    assert (door.position.x, door.position.y) == (999, -999)


# --- Images ---


def test_import_range_le_fichier_et_renvoie_son_chemin(vault):
    path = vault.import_file("photo.PNG", b"\x89PNG\r\n\x1a\n")
    assert path == "Assets/photo.png"
    assert (vault.root / path).read_bytes().startswith(b"\x89PNG")


def test_import_refuse_ce_qui_nest_pas_une_image(vault):
    with pytest.raises(Exception):
        vault.import_file("virus.exe", b"MZ")


def test_import_ne_remplace_jamais_un_fichier_existant(vault):
    first = vault.import_file("photo.png", b"a")
    second = vault.import_file("photo.png", b"b")
    assert first != second
    assert (vault.root / first).read_bytes() == b"a"


def test_images_accrochees_a_une_note(vault):
    image = AttachedImage(path="Assets/photo.png", position=Position(x=90, y=-70), caption="cap")
    vault.import_file("photo.png", b"a")
    vault.set_images("orpheline.md", [image])
    note = next(item for item in vault.scene("").notes if item.id == "orpheline.md")
    assert note.images[0].path == "Assets/photo.png"
    assert note.images[0].position.x == 90


def test_image_hors_du_vault_est_refusee(vault):
    image = AttachedImage(path="../../ailleurs.png")
    with pytest.raises(Exception):
        vault.set_images("orpheline.md", [image])


# --- Surveillance ---


def test_les_ecritures_de_lapplication_sont_reconnues(vault):
    vault.write_note("orpheline.md", "Nouveau contenu.\n")
    assert vault.wrote_recently(vault.root / "orpheline.md")
    assert not vault.wrote_recently(vault.root / "Projets" / "Mentaliis.md")


def test_le_dossier_parent_compte_aussi_comme_ecriture_interne(vault):
    # Windows signale le dossier contenant en plus du fichier : sans cela,
    # chaque enregistrement reviendrait comme une modification externe.
    vault.write_note("Vision/Cap 2030.md", "Revise.\n")
    assert vault.wrote_recently(vault.root / "Vision")


def test_un_dossier_non_touche_reste_externe(vault):
    vault.write_note("Vision/Cap 2030.md", "Revise.\n")
    assert not vault.wrote_recently(vault.root / "Projets")
