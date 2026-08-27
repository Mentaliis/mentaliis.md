"""Tests du dossier des medias, et des traits multiples entre elements."""

from __future__ import annotations

import pytest

from mentaliis_engine.vault import Vault


@pytest.fixture()
def vault(tmp_path):
    (tmp_path / ".MEDIAS" / "photos").mkdir(parents=True)
    (tmp_path / ".MEDIAS" / ".SVG").mkdir()
    (tmp_path / "Projets").mkdir()
    (tmp_path / "Vision").mkdir()
    (tmp_path / "Sante").mkdir()
    (tmp_path / ".MEDIAS" / "cap.png").write_bytes(b"png")
    (tmp_path / ".MEDIAS" / "photos" / "mer.jpg").write_bytes(b"jpg")
    (tmp_path / ".MEDIAS" / ".SVG" / "fusee.svg").write_text("<svg/>", "utf-8")
    (tmp_path / ".MEDIAS" / ".SVG" / "coeur.png").write_bytes(b"png")
    (tmp_path / ".MEDIAS" / ".SVG" / "etoile.webp").write_bytes(b"webp")
    (tmp_path / ".MEDIAS" / ".SVG" / "refuse.gif").write_bytes(b"gif")
    (tmp_path / "Projets" / "ailleurs.png").write_bytes(b"png")
    return Vault(tmp_path)


# --- La reserve, au nom impose ---


def test_la_reserve_porte_un_nom_impose(vault):
    assert vault.media().folder == ".MEDIAS"
    assert vault.media().icons_folder == ".MEDIAS/.SVG"


def test_un_dossier_quelconque_devient_un_vault_complet(tmp_path):
    """Ouvrir un dossier suffit : la reserve est posee au meme instant.

    Elle portait autrefois la possibilite d'etre absente, et l'interface devait
    l'expliquer. Les noms `.MEDIAS` et `.SVG` etant imposes, autant les creer.
    """
    (tmp_path / "Projets").mkdir()
    reserve = Vault(tmp_path).media()
    assert reserve.exists is True
    assert reserve.icons_exist is True
    # Creee, mais vide : ce qu'on y range n'appartient qu'a son proprietaire.
    assert reserve.images == [] and reserve.icons == []


def test_la_reserve_est_vue_meme_si_elle_commence_par_un_point(vault):
    assert vault.media().exists is True
    assert vault.media().icons_exist is True


def test_la_reserve_napparait_pas_comme_une_porte(vault):
    assert ".MEDIAS" not in {porte.id for porte in vault.scene("").doors}


# --- Ce que le dossier contient ---


def test_les_images_du_dossier_sont_listees(vault):
    assert vault.media().images == [".MEDIAS/cap.png", ".MEDIAS/photos/mer.jpg"]


def test_les_images_hors_du_dossier_sont_ignorees(vault):
    assert "Projets/ailleurs.png" not in vault.media().images


# --- L'image de vision ---


def test_une_image_du_dossier_est_acceptee(vault):
    porte = vault.set_cover("Projets", ".MEDIAS/cap.png")
    assert porte.cover == ".MEDIAS/cap.png"


def test_une_image_hors_du_dossier_est_refusee(vault):
    with pytest.raises(Exception):
        vault.set_cover("Projets", "Projets/ailleurs.png")


def test_meme_une_image_bien_rangee_ailleurs_est_refusee(vault):
    with pytest.raises(Exception):
        vault.set_cover("Projets", "Projets/ailleurs.png")


def test_retirer_une_image_reste_possible(vault):
    vault.set_cover("Projets", ".MEDIAS/cap.png")
    assert vault.set_cover("Projets", None).cover is None


# --- Plusieurs traits sur un meme element ---


def liens(vault):
    return {(link.source, link.target) for link in vault.scene("").links}


def test_une_porte_se_relie_a_plusieurs_autres(vault):
    # Surjection : la meme arrivee recoit plusieurs departs.
    (vault.root / "Argent").mkdir()
    vault.link("Projets", "Vision")
    vault.link("Projets", "Sante")
    vault.link("Projets", "Argent")
    assert liens(vault) == {
        ("Argent", "Projets"),
        ("Projets", "Sante"),
        ("Projets", "Vision"),
    }


def test_plusieurs_portes_se_relient_a_la_meme(vault):
    vault.link("Vision", "Projets")
    vault.link("Sante", "Projets")
    assert len([l for l in vault.scene("").links if "Projets" in (l.source, l.target)]) == 2


def test_un_reseau_complet_tient_debout(vault):
    # Chacun relie a chacun : rien ne se marche dessus.
    (vault.root / "Argent").mkdir()
    portes = ["Argent", "Projets", "Sante", "Vision"]
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


# --- Icones de portes ---


def test_les_icones_de_la_reserve_sont_listees(vault):
    assert vault.media().icons == [
        ".MEDIAS/.SVG/coeur.png",
        ".MEDIAS/.SVG/etoile.webp",
        ".MEDIAS/.SVG/fusee.svg",
    ]


def test_un_format_non_permis_est_ignore(vault):
    assert not any(icon.endswith(".gif") for icon in vault.media().icons)


def test_les_icones_ne_polluent_pas_les_images_de_vision(vault):
    assert vault.media().images == [".MEDIAS/cap.png", ".MEDIAS/photos/mer.jpg"]


def test_habiller_une_porte_avec_son_icone(vault):
    porte = vault.set_icon("Projets", ".MEDIAS/.SVG/fusee.svg")
    assert porte.icon == ".MEDIAS/.SVG/fusee.svg"
    assert next(d for d in vault.scene("").doors if d.id == "Projets").icon == (
        ".MEDIAS/.SVG/fusee.svg"
    )


def test_les_trois_formats_sont_acceptes(vault):
    for icon in (".MEDIAS/.SVG/fusee.svg", ".MEDIAS/.SVG/coeur.png", ".MEDIAS/.SVG/etoile.webp"):
        assert vault.set_icon("Projets", icon).icon == icon


def test_un_format_refuse_ne_passe_pas(vault):
    with pytest.raises(Exception):
        vault.set_icon("Projets", ".MEDIAS/.SVG/refuse.gif")


def test_une_icone_rangee_ailleurs_est_refusee(vault):
    with pytest.raises(Exception):
        vault.set_icon("Projets", ".MEDIAS/cap.png")
    with pytest.raises(Exception):
        vault.set_icon("Projets", "Projets/ailleurs.png")


def test_une_icone_inexistante_est_refusee(vault):
    with pytest.raises(Exception):
        vault.set_icon("Projets", ".MEDIAS/.SVG/jamais-vue.svg")


def test_les_deux_apparences_fournies_restent_valides(vault):
    assert vault.set_icon("Projets", "cerveau").icon == "cerveau"
    assert vault.set_icon("Projets", "porte").icon == "porte"


def test_une_icone_survit_a_une_reouverture(tmp_path, vault):
    vault.set_icon("Projets", ".MEDIAS/.SVG/coeur.png")
    portes = Vault(tmp_path).scene("").doors
    assert next(d for d in portes if d.id == "Projets").icon == ".MEDIAS/.SVG/coeur.png"


def test_un_layout_ecrit_a_la_main_ne_casse_rien(vault):
    # Une valeur bricolee hors de la reserve retombe sur la porte.
    vault.layout.set_field("Projets", "icon", "/etc/passwd")
    assert next(d for d in vault.scene("").doors if d.id == "Projets").icon == "porte"


# --- Nommage des nouvelles notes ---


def test_une_deuxieme_note_du_meme_nom_prend_un_numero(vault):
    premiere = vault.create_note("Projets", "Nouvelle Note")
    deuxieme = vault.create_note("Projets", "Nouvelle Note")
    troisieme = vault.create_note("Projets", "Nouvelle Note")
    assert premiere.id == "Projets/Nouvelle Note.md"
    assert deuxieme.id == "Projets/Nouvelle Note (1).md"
    assert troisieme.id == "Projets/Nouvelle Note (2).md"
    # Le titre affiche doit suivre, sinon les trois se ressemblent a l'ecran.
    assert [premiere.title, deuxieme.title, troisieme.title] == [
        "Nouvelle Note",
        "Nouvelle Note (1)",
        "Nouvelle Note (2)",
    ]


def test_renommer_la_premiere_libere_son_nom(vault):
    vault.create_note("Projets", "Nouvelle Note")
    vault.retitle("Projets/Nouvelle Note.md", "Un vrai titre")
    reprise = vault.create_note("Projets", "Nouvelle Note")
    assert reprise.id == "Projets/Nouvelle Note.md"


def test_retitrer_vers_un_nom_pris_ne_recouvre_rien(vault):
    vault.create_note("Projets", "Alpha")
    vault.create_note("Projets", "Beta")
    renommee = vault.retitle("Projets/Beta.md", "Alpha")
    assert renommee.id == "Projets/Alpha (1).md"
    assert (vault.root / "Projets" / "Alpha.md").exists()


# --- Images posees dans une scene ---


def images(vault, parent=""):
    return vault.scene(parent).images


def test_aucune_image_posee_au_depart(vault):
    assert images(vault) == []


def test_poser_une_image_dans_une_scene(vault):
    posee = vault.add_scene_image("", ".MEDIAS/cap.png")
    assert posee.path == ".MEDIAS/cap.png"
    assert posee.size == 1
    assert [i.id for i in images(vault)] == [posee.id]


def test_une_image_posee_nappartient_qu_a_sa_scene(vault):
    vault.add_scene_image("Projets", ".MEDIAS/cap.png")
    assert images(vault) == []
    assert len(images(vault, "Projets")) == 1


def test_une_image_hors_de_la_reserve_est_refusee(vault):
    with pytest.raises(Exception):
        vault.add_scene_image("", "Projets/ailleurs.png")


def test_un_fichier_qui_nest_pas_une_image_est_refuse(vault):
    (vault.root / ".MEDIAS" / "note.txt").write_text("bonjour", "utf-8")
    with pytest.raises(Exception):
        vault.add_scene_image("", ".MEDIAS/note.txt")


def test_les_trois_tailles(vault):
    posee = vault.add_scene_image("", ".MEDIAS/cap.png")
    for taille in (1, 2, 3):
        assert vault.set_image_size(posee.id, taille).size == taille


def test_une_taille_absurde_est_ramenee_dans_les_clous(vault):
    posee = vault.add_scene_image("", ".MEDIAS/cap.png")
    vault.layout.set_field(posee.id, "size", 99)
    assert images(vault)[0].size == 3


def test_une_image_posee_se_deplace(vault):
    posee = vault.add_scene_image("", ".MEDIAS/cap.png")
    vault.move(posee.id, 240, -120)
    place = images(vault)[0]
    assert (place.position.x, place.position.y) == (240, -120)


def test_une_image_posee_se_relie_aux_autres(vault):
    posee = vault.add_scene_image("", ".MEDIAS/cap.png")
    vault.link(posee.id, "Projets")
    liens = {(l.source, l.target) for l in vault.scene("").links}
    assert liens == {tuple(sorted((posee.id, "Projets")))}


def test_on_ne_relie_pas_deux_scenes(vault):
    ici = vault.add_scene_image("", ".MEDIAS/cap.png")
    ailleurs = vault.add_scene_image("Projets", ".MEDIAS/cap.png")
    with pytest.raises(Exception):
        vault.link(ici.id, ailleurs.id)


def test_retirer_une_image_nefface_pas_le_fichier(vault):
    posee = vault.add_scene_image("", ".MEDIAS/cap.png")
    vault.delete(posee.id)
    assert images(vault) == []
    assert (vault.root / ".MEDIAS" / "cap.png").exists()


def test_retirer_une_image_emporte_ses_traits(vault):
    posee = vault.add_scene_image("", ".MEDIAS/cap.png")
    vault.link(posee.id, "Projets")
    vault.delete(posee.id)
    assert vault.layout.links() == []


def test_les_images_posees_survivent_a_une_reouverture(tmp_path, vault):
    posee = vault.add_scene_image("", ".MEDIAS/cap.png")
    vault.set_image_size(posee.id, 3)
    vault.move(posee.id, 10, 20)
    relue = Vault(tmp_path).scene("").images[0]
    assert (relue.path, relue.size, relue.position.x) == (".MEDIAS/cap.png", 3, 10)


# --- Taille des images accrochees a une note ---


def test_une_image_de_note_a_une_taille(vault):
    from mentaliis_engine.models import AttachedImage

    vault.set_images("Projets/idee.md", []) if (vault.root / "Projets" / "idee.md").exists() else None
    (vault.root / "Projets" / "idee.md").write_text("# Idee\n", "utf-8")
    vault.set_images("Projets/idee.md", [AttachedImage(path=".MEDIAS/cap.png", size=2)])
    note = next(n for n in vault.scene("Projets").notes if n.id == "Projets/idee.md")
    assert note.images[0].size == 2


def test_la_taille_par_defaut_est_la_plus_petite(vault):
    from mentaliis_engine.models import AttachedImage

    (vault.root / "Projets" / "idee.md").write_text("# Idee\n", "utf-8")
    vault.set_images("Projets/idee.md", [AttachedImage(path=".MEDIAS/cap.png")])
    note = next(n for n in vault.scene("Projets").notes if n.id == "Projets/idee.md")
    assert note.images[0].size == 1


# --- L'extrait d'une carte ne montre aucune syntaxe ---


def extrait(vault, contenu):
    from mentaliis_engine.vault import markdown as md

    return md.excerpt_of(contenu)


def test_lextrait_retire_les_marqueurs_de_style(vault):
    assert extrait(vault, "Du **gras**, de l'*italique* et du `code`.") == (
        "Du gras, de l'italique et du code."
    )


def test_lextrait_retire_les_puces_et_les_cases(vault):
    assert extrait(vault, "- [ ] Une tache\n- Une puce") == "Une tache Une puce"


def test_lextrait_garde_le_texte_des_liens(vault):
    assert extrait(vault, "Voir [[Cap 2030]] et [le site](https://exemple.fr).") == (
        "Voir Cap 2030 et le site."
    )


def test_lextrait_retire_les_images(vault):
    assert extrait(vault, "Avant ![[schema.png]] apres") == "Avant apres"


def test_lextrait_ignore_tableaux_et_formules(vault):
    contenu = "| a | b |\n| --- | --- |\n| 1 | 2 |\n\nDu texte."
    assert extrait(vault, contenu) == "Du texte."


def test_lextrait_retire_les_chevrons_de_citation(vault):
    assert extrait(vault, "> Une citation.") == "Une citation."


def test_une_multiplication_nest_pas_prise_pour_de_l_italique(vault):
    assert extrait(vault, "3 * 4 = 12") == "3 * 4 = 12"
