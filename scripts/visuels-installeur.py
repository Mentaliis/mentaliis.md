"""Dessine les visuels de l'installeur Mentaliis.

NSIS n'accepte que du BMP pour son bandeau et son panneau lateral, et un .ico
pour l'icone du programme d'installation. Ces fichiers sont versionnes : ce
script ne sert qu'a les refaire si l'identite visuelle change.

    engine/.venv/Scripts/python.exe scripts/visuels-installeur.py

L'esprit est celui de l'application : un bleu de nuit profond, une porte qui
s'ouvre sur une lueur, des angles francs — le rayon de 1 pixel partout.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "src-tauri" / "installer"
SORTIE.mkdir(parents=True, exist_ok=True)

# Les couleurs de Mentaliis, reprises de `frontend/src/styles/global.css`.
NUIT = (7, 11, 20)
FOND = (11, 18, 32)
BLEU = (91, 140, 255)
BLEU_PALE = (150, 185, 255)
TEXTE = (230, 236, 247)
DISCRET = (139, 155, 184)


def fond_etoile(largeur: int, hauteur: int) -> Image.Image:
    """Le bleu de nuit, avec une lueur douce et une poussiere d'etoiles."""
    image = Image.new("RGB", (largeur, hauteur), NUIT)
    dessin = ImageDraw.Draw(image)

    # Une lueur ronde, un peu au-dessus du centre : la meme que derriere les portes.
    foyer_x, foyer_y = largeur * 0.5, hauteur * 0.32
    rayon = max(largeur, hauteur) * 0.85
    for pas in range(60, 0, -1):
        t = pas / 60
        r = rayon * t
        melange = (1 - t) ** 2.2
        couleur = tuple(
            int(NUIT[i] + (FOND[i] + (BLEU[i] - FOND[i]) * 0.22 - NUIT[i]) * melange)
            for i in range(3)
        )
        dessin.ellipse(
            [foyer_x - r, foyer_y - r * 0.8, foyer_x + r, foyer_y + r * 0.8], fill=couleur
        )

    # Des etoiles, regulieres mais jamais alignees.
    for index in range(int(largeur * hauteur / 900)):
        x = (index * 7919) % largeur
        y = (index * 104_729) % hauteur
        eclat = 0.25 + ((index * 31) % 100) / 160
        taille = 1 if index % 5 else 2
        couleur = tuple(int(NUIT[i] + (TEXTE[i] - NUIT[i]) * eclat * 0.55) for i in range(3))
        dessin.ellipse([x, y, x + taille - 1, y + taille - 1], fill=couleur)

    return image


def porte(dessin: ImageDraw.ImageDraw, x: int, y: int, largeur: int, hauteur: int) -> None:
    """La porte de Mentaliis : un rectangle net, sa poignee, sa lueur."""
    # Le panneau, degrade du haut vers le bas.
    for ligne in range(hauteur):
        t = ligne / max(1, hauteur - 1)
        couleur = (
            int(27 + (18 - 27) * t),
            int(44 + (29 - 44) * t),
            int(77 + (51 - 77) * t),
        )
        dessin.line([(x, y + ligne), (x + largeur, y + ligne)], fill=couleur)

    # Le contour, franc, sans arrondi : la regle du rayon de 1 pixel.
    dessin.rectangle([x, y, x + largeur, y + hauteur], outline=BLEU, width=2)

    # La poignee.
    pr = max(2, largeur // 22)
    px = x + largeur - largeur // 6
    py = y + hauteur // 2
    dessin.ellipse([px - pr, py - pr, px + pr, py + pr], fill=BLEU_PALE)


def lueur(image: Image.Image, boite: tuple[int, int, int, int], force: float = 1.0) -> Image.Image:
    """Ajoute un halo autour d'une zone, en la redessinant floue par-dessous."""
    halo = Image.new("RGB", image.size, (0, 0, 0))
    dessin = ImageDraw.Draw(halo)
    x0, y0, x1, y1 = boite
    dessin.rectangle(boite, outline=BLEU, width=3)
    halo = halo.filter(ImageFilter.GaussianBlur(radius=max(image.size) // 26))
    return Image.blend(image, Image.blend(image, halo, 0.0), 0.0) if force == 0 else Image.eval(
        Image.merge(
            "RGB",
            [
                Image.blend(image.split()[i], halo.split()[i], min(0.55, 0.42 * force))
                for i in range(3)
            ],
        ),
        lambda v: v,
    )


def police(taille: int, gras: bool = False) -> ImageFont.FreeTypeFont:
    """Une police du systeme, avec un repli si elle manque."""
    for nom in (
        "segoeuib.ttf" if gras else "segoeui.ttf",
        "arialbd.ttf" if gras else "arial.ttf",
        "DejaVuSans-Bold.ttf" if gras else "DejaVuSans.ttf",
    ):
        for dossier in (r"C:\Windows\Fonts", "/usr/share/fonts/truetype/dejavu"):
            chemin = Path(dossier) / nom
            if chemin.is_file():
                try:
                    return ImageFont.truetype(str(chemin), taille)
                except OSError:
                    continue
    return ImageFont.load_default()


def espace(dessin: ImageDraw.ImageDraw, texte: str, x: int, y: int, fonte, couleur, ecart: int):
    """Ecrit en espacant les lettres, comme le nom de l'application a l'ecran."""
    curseur = x
    for lettre in texte:
        dessin.text((curseur, y), lettre, font=fonte, fill=couleur)
        curseur += int(dessin.textlength(lettre, font=fonte)) + ecart
    return curseur - x - ecart


def largeur_espacee(dessin: ImageDraw.ImageDraw, texte: str, fonte, ecart: int) -> int:
    return sum(int(dessin.textlength(l, font=fonte)) + ecart for l in texte) - ecart


# ---------------------------------------------------------------- Le bandeau
# 150 x 57 : la bande du haut, visible sur toutes les pages de l'installeur.
def bandeau() -> None:
    image = fond_etoile(150, 57)
    dessin = ImageDraw.Draw(image)
    porte(dessin, 12, 10, 22, 37)
    fonte = police(13, gras=True)
    espace(dessin, "MENTALIIS", 46, 15, fonte, TEXTE, 1)
    petite = police(8)
    dessin.text((46, 33), "Un second cerveau spatial", font=petite, fill=DISCRET)
    image.save(SORTIE / "header.bmp", "BMP")
    print("  header.bmp        150x57")


# ------------------------------------------------------------ Le panneau lateral
# 164 x 314 : la grande image des pages d'accueil et de fin.
def panneau() -> None:
    image = fond_etoile(164, 314)
    dessin = ImageDraw.Draw(image)

    porte(dessin, 52, 84, 60, 100)

    fonte = police(15, gras=True)
    large = largeur_espacee(dessin, "MENTALIIS", fonte, 2)
    espace(dessin, "MENTALIIS", (164 - large) // 2, 210, fonte, TEXTE, 2)

    petite = police(9)
    for index, ligne in enumerate(("Chaque dossier", "est une porte.")):
        w = dessin.textlength(ligne, font=petite)
        dessin.text(((164 - w) / 2, 236 + index * 13), ligne, font=petite, fill=DISCRET)

    minuscule = police(8)
    pied = "AJTVIRTUAL"
    w = dessin.textlength(pied, font=minuscule)
    dessin.text(((164 - w) / 2, 292), pied, font=minuscule, fill=(70, 84, 110))

    image.save(SORTIE / "sidebar.bmp", "BMP")
    print("  sidebar.bmp       164x314")


# ------------------------------------------------------------- L'icone du setup
def icone() -> None:
    """L'icone du programme d'installation : la porte, dans un carre de nuit."""
    tailles = [16, 24, 32, 48, 64, 128, 256]
    grande = 256
    image = fond_etoile(grande, grande)
    dessin = ImageDraw.Draw(image)

    # Une porte bien centree, aux proportions de celle de l'application.
    largeur, hauteur = 96, 132
    x = (grande - largeur) // 2
    y = (grande - hauteur) // 2
    porte(dessin, x, y, largeur, hauteur)

    # Un halo derriere elle, pour la detacher a petite taille.
    halo = Image.new("RGB", image.size, (0, 0, 0))
    ImageDraw.Draw(halo).rectangle([x, y, x + largeur, y + hauteur], outline=BLEU, width=6)
    halo = halo.filter(ImageFilter.GaussianBlur(radius=14))
    image = Image.merge(
        "RGB",
        [Image.blend(image.split()[i], halo.split()[i], 0.45) for i in range(3)],
    )
    # On redessine la porte par-dessus le halo pour qu'elle reste nette.
    dessin = ImageDraw.Draw(image)
    porte(dessin, x, y, largeur, hauteur)

    image.save(SORTIE / "icon.ico", "ICO", sizes=[(t, t) for t in tailles])
    print(f"  icon.ico          {', '.join(str(t) for t in tailles)}")


# ------------------------------------------------- Le fond de l'image disque macOS
def fond_dmg() -> None:
    """540 x 380 : ce que l'on voit en ouvrant le .dmg sur un Mac."""
    image = fond_etoile(540, 380)
    dessin = ImageDraw.Draw(image)

    fonte = police(22, gras=True)
    large = largeur_espacee(dessin, "MENTALIIS", fonte, 4)
    espace(dessin, "MENTALIIS", (540 - large) // 2, 40, fonte, TEXTE, 4)

    petite = police(12)
    ligne = "Glissez Mentaliis dans Applications"
    w = dessin.textlength(ligne, font=petite)
    dessin.text(((540 - w) / 2, 76), ligne, font=petite, fill=DISCRET)

    # La fleche entre les deux icones, que le Finder posera a 130 et 410.
    y = 205
    dessin.line([(215, y), (325, y)], fill=(70, 90, 130), width=2)
    for pointe in range(12):
        dessin.line([(325 - pointe, y - pointe // 2), (325, y)], fill=(90, 115, 165))
        dessin.line([(325 - pointe, y + pointe // 2), (325, y)], fill=(90, 115, 165))

    minuscule = police(9)
    pied = "AJTVIRTUAL - AMILCAR JOAO"
    w = dessin.textlength(pied, font=minuscule)
    dessin.text(((540 - w) / 2, 348), pied, font=minuscule, fill=(62, 74, 98))

    image.save(SORTIE / "dmg-fond.png", "PNG")
    print("  dmg-fond.png      540x380")


if __name__ == "__main__":
    print("Visuels de l'installeur :")
    bandeau()
    panneau()
    icone()
    fond_dmg()
    print(f"\nEcrits dans {SORTIE}")
