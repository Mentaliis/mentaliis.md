"""Ranger une note ou une porte ailleurs, sans passer par l'explorateur.

Deplacer, ce n'est pas seulement bouger un fichier : la position dans la scene,
l'icone choisie, l'image de vision, le cadrage de la porte et les traits qui la
relient doivent suivre. Sinon on retrouve son element nu a l'arrivee.
"""

from __future__ import annotations

import pytest

from mentaliis_engine.vault.vault import Vault, VaultError


@pytest.fixture
def vault(tmp_path):
    (tmp_path / "Projets").mkdir()
    (tmp_path / "Archives").mkdir()
    (tmp_path / "Projets" / "Sous-dossier").mkdir()
    (tmp_path / "note.md").write_text("# Une note\n\nDu texte.\n", encoding="utf-8")
    (tmp_path / "Projets" / "plan.md").write_text("# Plan\n", encoding="utf-8")
    return Vault(tmp_path)


def test_une_note_change_de_dossier(vault):
    nouveau = vault.move_to("note.md", "Archives")
    assert nouveau == "Archives/note.md"
    assert (vault.root / "Archives" / "note.md").is_file()
    assert not (vault.root / "note.md").exists()
    assert vault.read_note(nouveau).content.startswith("# Une note")


def test_une_porte_emporte_ce_qu_elle_contient(vault):
    nouveau = vault.move_to("Projets", "Archives")
    assert nouveau == "Archives/Projets"
    assert (vault.root / "Archives" / "Projets" / "plan.md").is_file()
    assert (vault.root / "Archives" / "Projets" / "Sous-dossier").is_dir()


def test_l_icone_la_vision_et_le_cadrage_suivent(vault):
    from mentaliis_engine.models import Camera

    vault.set_icon("Projets", "cerveau")
    vault.set_icon_size("Projets", 2)
    vault.set_camera("Projets", Camera(x=120.0, y=-40.0, scale=0.75))

    vault.move_to("Projets", "Archives")

    porte = next(p for p in vault.scene("Archives").doors if p.id == "Archives/Projets")
    assert porte.icon == "cerveau"
    assert porte.icon_size == 2
    cadrage = vault.camera("Archives/Projets")
    assert cadrage is not None
    assert (cadrage.x, cadrage.y, cadrage.scale) == (120.0, -40.0, 0.75)


def test_les_traits_vers_l_ancien_endroit_sont_rompus(vault):
    """Un trait dit « ceci va avec cela » dans une scene donnee.

    Range ailleurs, l'element ne cotoie plus ce qu'il cotoyait : le trait ne
    relierait plus que deux endroits sans rapport.
    """
    vault.link("note.md", "Projets")
    vault.move_to("note.md", "Archives")
    relies = {tuple(sorted(pair)) for pair in vault.layout.links()}
    assert ("Archives/note.md", "Projets") not in relies
    assert ("note.md", "Projets") not in relies


def test_mais_les_traits_internes_suivent(vault):
    """Ce qu'une porte emporte avec elle garde ses traits : ils ont un sens."""
    (vault.root / "Projets" / "autre.md").write_text("# Autre" + chr(10), encoding="utf-8")
    vault.link("Projets/plan.md", "Projets/autre.md")
    vault.move_to("Projets", "Archives")
    relies = {tuple(sorted(pair)) for pair in vault.layout.links()}
    assert ("Archives/Projets/autre.md", "Archives/Projets/plan.md") in relies


def test_l_icone_sa_taille_et_la_vision_survivent_au_deplacement(vault):
    """Ce sont des attributs de l'element : ils ne dependent pas de l'endroit."""
    reserve = vault.root / ".MEDIAS"
    reserve.mkdir(exist_ok=True)
    (reserve / "vision.png").write_bytes(bytes([0x89]) + b"PNG")

    vault.set_icon("Projets", "cerveau")
    vault.set_icon_size("Projets", 2)
    vault.set_cover("Projets", ".MEDIAS/vision.png")

    vault.move_to("Projets", "Archives")

    porte = next(p for p in vault.scene("Archives").doors if p.id == "Archives/Projets")
    assert porte.icon == "cerveau"
    assert porte.icon_size == 2
    assert porte.cover == ".MEDIAS/vision.png"


def test_la_place_dans_la_scene_est_oubliee(vault):
    """L'ancienne place n'a plus de sens ailleurs : elle recouvrirait un voisin."""
    vault.move("note.md", 480.0, -260.0)
    nouveau = vault.move_to("note.md", "Archives")
    assert vault.layout.position(nouveau) is None


def test_un_dossier_ne_peut_pas_entrer_en_lui_meme(vault):
    with pytest.raises(VaultError):
        vault.move_to("Projets", "Projets")
    with pytest.raises(VaultError):
        vault.move_to("Projets", "Projets/Sous-dossier")
    assert (vault.root / "Projets" / "plan.md").is_file()


def test_deplacer_la_ou_l_on_est_deja_ne_fait_rien(vault):
    assert vault.move_to("Projets/plan.md", "Projets") == "Projets/plan.md"
    assert (vault.root / "Projets" / "plan.md").is_file()


def test_un_homonyme_a_l_arrivee_est_renomme(vault):
    (vault.root / "Archives" / "note.md").write_text("# Deja la\n", encoding="utf-8")
    nouveau = vault.move_to("note.md", "Archives")
    assert nouveau == "Archives/note (1).md"
    # Celle qui etait deja la n'a pas ete ecrasee.
    assert (vault.root / "Archives" / "note.md").read_text(encoding="utf-8") == "# Deja la\n"


def test_on_peut_remonter_a_la_racine(vault):
    assert vault.move_to("Projets/plan.md", "") == "plan.md"
    assert (vault.root / "plan.md").is_file()


def test_un_dossier_cache_n_est_pas_une_destination(vault):
    with pytest.raises(VaultError):
        vault.move_to("note.md", ".MEDIAS")


def test_une_destination_inexistante_est_refusee(vault):
    with pytest.raises(VaultError):
        vault.move_to("note.md", "Nulle part")


def test_la_liste_des_destinations_couvre_le_vault(vault):
    dossiers = vault.folders()
    par_id = {d.id: d for d in dossiers}
    assert "" in par_id and par_id[""].depth == 0
    assert par_id["Projets"].depth == 1
    assert par_id["Projets/Sous-dossier"].depth == 2
    # La reserve de medias n'est pas un endroit ou ranger des notes.
    assert not any(d.id.startswith(".") for d in dossiers)
