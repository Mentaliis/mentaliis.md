"""Le developpement ne doit pas ecraser les reglages de l'application installee.

Les deux moteurs lisent le meme genre de fichier : le souvenir du dernier Vault
ouvert, la taille de l'ecriture, la largeur de la bande. S'ils partagent le
meme dossier, ouvrir un Vault de test remplace le souvenir de celui qui
travaille — et au demarrage suivant, l'application installee ouvre le Vault de
demonstration a la place du sien. C'est arrive.
"""

from __future__ import annotations

import sys

from mentaliis_engine import config


def test_le_moteur_installe_et_celui_de_developpement_ne_se_melangent_pas(
    tmp_path, monkeypatch
):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    monkeypatch.delenv("MENTALIIS_CONFIG_DIR", raising=False)

    # Le moteur de developpement : lance depuis les sources, jamais fige.
    monkeypatch.delattr(sys, "frozen", raising=False)
    developpement = config.app_data_dir()

    # Le moteur livre : fige par PyInstaller, qui pose cet attribut.
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    installe = config.app_data_dir()

    assert developpement != installe
    assert installe.name == "Mentaliis"
    assert developpement.name == "Mentaliis (dev)"


def test_le_moteur_installe_garde_le_dossier_historique(tmp_path, monkeypatch):
    """Les reglages deja en place ne doivent pas etre perdus par ce changement."""
    monkeypatch.setenv("APPDATA", str(tmp_path))
    monkeypatch.delenv("MENTALIIS_CONFIG_DIR", raising=False)
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    assert config.app_data_dir() == tmp_path / "Mentaliis"


def test_une_variable_d_environnement_isole_completement(tmp_path, monkeypatch):
    """De quoi mener des tests sans toucher ni a l'un ni a l'autre."""
    ailleurs = tmp_path / "ailleurs"
    monkeypatch.setenv("MENTALIIS_CONFIG_DIR", str(ailleurs))
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    assert config.app_data_dir() == ailleurs
    assert ailleurs.is_dir()


def test_le_dossier_est_cree_s_il_manque(tmp_path, monkeypatch):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    monkeypatch.delenv("MENTALIIS_CONFIG_DIR", raising=False)
    monkeypatch.delattr(sys, "frozen", raising=False)
    assert config.app_data_dir().is_dir()


# --- Le port ---


def test_les_deux_moteurs_n_ecoutent_pas_au_meme_endroit(monkeypatch):
    """Sinon travailler sur Mentaliis pendant que Mentaliis est ouvert les fait
    se disputer le port : le second meurt, et son interface se met a parler au
    premier — donc au Vault de quelqu'un d'autre."""
    import importlib

    monkeypatch.delenv("MENTALIIS_ENGINE_PORT", raising=False)

    monkeypatch.setattr(sys, "frozen", True, raising=False)
    livre = importlib.reload(config).PORT

    monkeypatch.delattr(sys, "frozen", raising=False)
    developpement = importlib.reload(config).PORT

    assert livre != developpement
    assert livre == config.PORT_LIVRE
    assert developpement == config.PORT_DEVELOPPEMENT


def test_une_variable_d_environnement_impose_le_port(monkeypatch):
    import importlib

    monkeypatch.setenv("MENTALIIS_ENGINE_PORT", "9999")
    assert importlib.reload(config).PORT == 9999
    monkeypatch.delenv("MENTALIIS_ENGINE_PORT")
    importlib.reload(config)
