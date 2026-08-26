"""Tests du dossier des medias, et des traits multiples entre elements."""

from __future__ import annotations

import pytest

from mentaliis_engine.vault import Vault


@pytest.fixture()
def vault(tmp_path):
    (tmp_path / "Medias").mkdir()
    (tmp_path / "Medias" / "photos").mkdir()
    (tmp_path / "Projets").mkdir()
    (tmp_path / "Vision").mkdir()
    (tmp_path / "Sante").mkdir()
    (tmp_path / "Medias" / "cap.png").write_bytes(b"png")
    (tmp_path / "Medias" / "photos" / "mer.jpg").write_bytes(b"jpg")
    (tmp_path / "Projets" / "ailleurs.png").write_bytes(b"png")
    return Vault(tmp_path)


# --- Choix du dossier ---


def test_aucun_dossier_de_medias_au_depart(vault):
    assert vault.media().folder is None


def test_les_dossiers_du_vault_sont_proposes(vault):
    proposes = vault.media().folders
    assert "Medias" in proposes and "Projets" in proposes
    assert "Medias/photos" in proposes


def test_designer_un_dossier(vault):
    assert vault.set_media_folder("Medias") == "Medias"
    assert vault.media().folder == "Medias"


def test_un_dossier_inexistant_est_refuse(vault):
    with pytest.raises(Exception):
        vault.set_media_folder("Jamais vu")


def test_le_vault_entier_ne_peut_pas_servir(vault):
    with pytest.raises(Exception):
        vault.set_media_folder("")


def test_un_fichier_nest_pas_un_dossier(vault):
    with pytest.raises(Exception):
        vault.set_media_folder("Medias/cap.png")


def test_le_choix_survit_a_une_reouverture(tmp_path, vault):
    vault.set_media_folder("Medias")
    assert Vault(tmp_path).media().folder == "Medias"


def test_un_dossier_disparu_est_oublie(vault):
    vault.set_media_folder("Medias")
    vault.delete("Medias")
    assert vault.media().folder is None


# --- Ce que le dossier contient ---


def test_les_images_du_dossier_sont_listees(vault):
    vault.set_media_folder("Medias")
    assert vault.media().images == ["Medias/cap.png", "Medias/photos/mer.jpg"]


def test_les_images_hors_du_dossier_sont_ignorees(vault):
    vault.set_media_folder("Medias")
    assert "Projets/ailleurs.png" not in vault.media().images


# --- L'image de vision ---


def test_une_image_du_dossier_est_acceptee(vault):
    vault.set_media_folder("Medias")
    porte = vault.set_cover("Projets", "Medias/cap.png")
    assert porte.cover == "Medias/cap.png"


def test_une_image_hors_du_dossier_est_refusee(vault):
    vault.set_media_folder("Medias")
    with pytest.raises(Exception):
        vault.set_cover("Projets", "Projets/ailleurs.png")


def test_sans_dossier_configure_toute_image_du_vault_passe(vault):
    porte = vault.set_cover("Projets", "Projets/ailleurs.png")
    assert porte.cover == "Projets/ailleurs.png"


def test_retirer_une_image_reste_possible(vault):
    vault.set_media_folder("Medias")
    vault.set_cover("Projets", "Medias/cap.png")
    assert vault.set_cover("Projets", None).cover is None


# --- Plusieurs traits sur un meme element ---


def liens(vault):
    return {(link.source, link.target) for link in vault.scene("").links}


def test_une_porte_se_relie_a_plusieurs_autres(vault):
    # Surjection : la meme arrivee recoit plusieurs departs.
    vault.link("Projets", "Vision")
    vault.link("Projets", "Sante")
    vault.link("Projets", "Medias")
    assert liens(vault) == {
        ("Projets", "Vision"),
        ("Projets", "Sante"),
        ("Medias", "Projets"),
    }


def test_plusieurs_portes_se_relient_a_la_meme(vault):
    vault.link("Vision", "Projets")
    vault.link("Sante", "Projets")
    assert len([l for l in vault.scene("").links if "Projets" in (l.source, l.target)]) == 2


def test_un_reseau_complet_tient_debout(vault):
    # Chacun relie a chacun : rien ne se marche dessus.
    portes = ["Medias", "Projets", "Sante", "Vision"]
    for i, a in enumerate(portes):
        for b in portes[i + 1 :]:
            vault.link(a, b)
    assert len(vault.scene("").links) == 6


def test_detacher_un_trait_laisse_les_autres(vault):
    vault.link("Projets", "Vision")
    vault.link("Projets", "Sante")
    vault.unlink("Projets", "Vision")
    assert liens(vault) == {("Projets", "Sante")}


# --- Changer le titre d'une note ---


def test_retitrer_met_a_jour_le_texte_et_le_fichier(vault):
    (vault.root / "Projets" / "idee.md").write_text("# Idee\n\nDu texte.\n", "utf-8")
    note = vault.retitle("Projets/idee.md", "Grande idee")
    assert note.id == "Projets/Grande idee.md"
    assert note.title == "Grande idee"
    assert note.content.startswith("# Grande idee")
    assert "Du texte." in note.content


def test_retitrer_respecte_le_frontmatter(vault):
    (vault.root / "Projets" / "cap.md").write_text(
        "---\ntitle: Ancien\n---\n\nDu texte.\n", "utf-8"
    )
    note = vault.retitle("Projets/cap.md", "Nouveau")
    assert note.frontmatter["title"] == "Nouveau"
    assert note.title == "Nouveau"


def test_retitrer_une_note_sans_titre_lui_en_pose_un(vault):
    (vault.root / "Projets" / "brut.md").write_text("Juste du texte.\n", "utf-8")
    note = vault.retitle("Projets/brut.md", "Enfin un titre")
    assert note.content.startswith("# Enfin un titre")
    assert "Juste du texte." in note.content


def test_un_titre_vide_est_refuse(vault):
    (vault.root / "Projets" / "idee.md").write_text("# Idee\n", "utf-8")
    with pytest.raises(Exception):
        vault.retitle("Projets/idee.md", "   ")


def test_retitrer_conserve_la_position(vault):
    (vault.root / "Projets" / "idee.md").write_text("# Idee\n", "utf-8")
    vault.move("Projets/idee.md", 42, -42)
    note = vault.retitle("Projets/idee.md", "Autre")
    place = next(n for n in vault.scene("Projets").notes if n.id == note.id)
    assert (place.position.x, place.position.y) == (42, -42)
