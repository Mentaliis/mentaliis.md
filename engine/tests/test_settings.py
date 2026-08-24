"""Tests des preferences de l'utilisateur."""

from __future__ import annotations

import json

import pytest

from mentaliis_engine import settings as prefs
from mentaliis_engine.models import Settings


@pytest.fixture(autouse=True)
def dossier_isole(tmp_path, monkeypatch):
    """Les tests ne doivent pas toucher aux vraies preferences de la machine."""
    monkeypatch.setattr(prefs, "app_data_dir", lambda: tmp_path)
    return tmp_path


def test_sans_fichier_on_obtient_les_valeurs_par_defaut():
    reglages = prefs.load()
    assert reglages.zoom == 1
    assert reglages.rail_width == 210


def test_ce_qui_est_enregistre_se_relit():
    prefs.save(Settings(zoom=3, rail_width=380))
    relu = prefs.load()
    assert (relu.zoom, relu.rail_width) == (3, 380)


def test_enregistrer_ne_perd_pas_le_dernier_vault(dossier_isole):
    fichier = dossier_isole / "settings.json"
    fichier.write_text(json.dumps({"last_vault": "C:/quelque/part"}), encoding="utf-8")
    prefs.save(Settings(zoom=2))
    data = json.loads(fichier.read_text(encoding="utf-8"))
    assert data["last_vault"] == "C:/quelque/part"
    assert data["zoom"] == 2


def test_un_fichier_abime_ne_bloque_rien(dossier_isole):
    (dossier_isole / "settings.json").write_text("{ ceci n'est pas du json", encoding="utf-8")
    assert prefs.load().zoom == 1


def test_un_zoom_hors_limites_est_refuse():
    with pytest.raises(Exception):
        Settings(zoom=7)
    with pytest.raises(Exception):
        Settings(zoom=0)


def test_une_largeur_de_bande_hors_limites_est_refusee():
    with pytest.raises(Exception):
        Settings(rail_width=20)
    with pytest.raises(Exception):
        Settings(rail_width=2000)
