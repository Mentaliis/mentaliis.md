"""La reserve de medias existe des l'ouverture d'un Vault.

Les noms `.MEDIAS` et `.SVG` sont imposes, et toute l'application les suppose
presents : les icones, les visions, les images posees dans les scenes. Ouvrir
un dossier quelconque doit donc suffire a en faire un Vault complet.
"""

from __future__ import annotations

from mentaliis_engine.config import ICONS_DIR, MEDIAS_DIR
from mentaliis_engine.vault.vault import Vault


def test_la_reserve_est_creee_a_l_ouverture(tmp_path):
    Vault(tmp_path)
    assert (tmp_path / MEDIAS_DIR).is_dir()
    assert (tmp_path / MEDIAS_DIR / ICONS_DIR).is_dir()


def test_une_reserve_deja_la_est_laissee_intacte(tmp_path):
    icones = tmp_path / MEDIAS_DIR / ICONS_DIR
    icones.mkdir(parents=True)
    (icones / "porte.svg").write_text("<svg/>", encoding="utf-8")
    (tmp_path / MEDIAS_DIR / "photo.png").write_bytes(b"\x89PNG")

    Vault(tmp_path)

    # Rien n'est efface, rien n'est ajoute : ce que l'on a range reste range.
    assert (icones / "porte.svg").read_text(encoding="utf-8") == "<svg/>"
    assert (tmp_path / MEDIAS_DIR / "photo.png").is_file()


def test_la_reserve_est_vue_par_l_application(tmp_path):
    vault = Vault(tmp_path)
    reserve = vault.media()
    assert reserve.exists
    assert reserve.icons_exist
    assert reserve.folder == MEDIAS_DIR
    assert reserve.icons_folder == f"{MEDIAS_DIR}/{ICONS_DIR}"


def test_rouvrir_ne_casse_rien(tmp_path):
    Vault(tmp_path)
    Vault(tmp_path)
    assert (tmp_path / MEDIAS_DIR / ICONS_DIR).is_dir()


# --- Les trois echelles d'icone ---


def test_une_porte_naît_a_l_echelle_de_la_porte(tmp_path):
    (tmp_path / "Projets").mkdir()
    vault = Vault(tmp_path)
    porte = next(p for p in vault.scene("").doors if p.id == "Projets")
    assert porte.icon == "porte"
    assert porte.icon_size == 1


def test_un_cerveau_naît_au_double(tmp_path):
    """Le cerveau represente la connaissance : il est deux fois la porte."""
    (tmp_path / "Savoir").mkdir()
    vault = Vault(tmp_path)
    vault.set_icon("Savoir", "cerveau")
    porte = next(p for p in vault.scene("").doors if p.id == "Savoir")
    assert porte.icon_size == 3


def test_les_trois_echelles_s_enregistrent(tmp_path):
    (tmp_path / "Projets").mkdir()
    vault = Vault(tmp_path)
    for taille in (1, 2, 3):
        assert vault.set_icon_size("Projets", taille).icon_size == taille
        # Et cela survit a une relecture complete du Vault.
        relu = next(p for p in Vault(tmp_path).scene("").doors if p.id == "Projets")
        assert relu.icon_size == taille


def test_une_echelle_inconnue_est_refusee(tmp_path):
    import pytest

    from mentaliis_engine.vault.vault import VaultError

    (tmp_path / "Projets").mkdir()
    vault = Vault(tmp_path)
    for absurde in (0, 4, -1, 99):
        with pytest.raises(VaultError):
            vault.set_icon_size("Projets", absurde)


def test_une_echelle_abimee_dans_le_fichier_est_ignoree(tmp_path):
    (tmp_path / "Projets").mkdir()
    vault = Vault(tmp_path)
    vault.layout.set_field("Projets", "icon_size", "grand comme une maison")
    porte = next(p for p in Vault(tmp_path).scene("").doors if p.id == "Projets")
    assert porte.icon_size == 1
