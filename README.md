# Mentaliis

Un second cerveau **spatial**. Pas un gestionnaire de fichiers deguise : un environnement
dans lequel on entre, ou chaque dossier est une **porte** et chaque note un **objet** que
l'on place librement dans l'espace.

- Un **Vault** = un dossier racine reel sur le disque, contenant des `.md` en clair.
- Un **dossier** = une **porte** flottante, avec une image de couverture pour ancrer l'intention.
- Une **note** = une carte deplacable, a laquelle on peut attacher plusieurs images autour.
- Vue globale facon constellation, zoom / pan, positions persistees.

Aucun serveur distant, aucune connexion internet requise : tout est local.

---

## Architecture

```
MENTALIIS/
  package.json  Point d'entree : `npm run dev` lance toute l'application
  src-tauri/    Coquille native (Rust minimal) : la fenetre de l'application
  frontend/     L'univers visuel : portes, canvas, notes, editeur markdown (React + TS)
  engine/       Le moteur Python : Vault, parsing markdown, index, recherche (FastAPI local)
  docs/         Notes de conception et specifications
```

### Comment les morceaux se parlent

Au lancement, l'application demarre **deux processus sur la machine de l'utilisateur** :

1. la **fenetre** (Tauri + webview systeme) qui affiche l'interface ;
2. le **moteur Python**, invisible, qui gere les fichiers et la logique.

Ils communiquent en HTTP **sur `127.0.0.1` uniquement** (localhost = cette machine, et
personne d'autre). Rien ne sort de l'ordinateur, l'application fonctionne hors ligne.
Le moteur s'eteint automatiquement avec la fenetre.

---

## Stack

| Couche   | Techno |
|----------|--------|
| Fenetre native / packaging | Tauri 2 (Windows, macOS, Linux) |
| Interface  | React + TypeScript + Vite |
| Canvas spatial | DOM + transform CSS (entierement restylable en CSS) |
| Editeur markdown | CodeMirror 6, apercu vivant maison |
| Formules | KaTeX, charge seulement si une note en contient |
| Moteur | Python 3.11+ / FastAPI / Uvicorn |
| Stockage | Fichiers `.md` en clair + `.mentaliis/` (layout, cache) |

---

## Prerequis

- **Node.js** 18+
- **Python** 3.11+
- **Rust** (pour Tauri) : https://rustup.rs
- Windows : [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) + WebView2 (deja present sur Windows 10/11 a jour)

## Installation

Une seule fois :

```bash
# le moteur
cd engine
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux
pip install -e ".[dev]"
cd ..

# l'interface et la coquille native
npm install --prefix frontend
npm install
```

## Lancer l'application

Depuis la **racine du projet**, une seule commande :

```bash
npm run dev
```

Elle demarre tout : la fenetre native, le serveur de developpement de l'interface,
et le moteur Python — qui s'arrete automatiquement a la fermeture de la fenetre.

> La CLI Tauri cherche `tauri.conf.json` dans un sous-dossier de son dossier courant.
> Elle doit donc etre lancee depuis la racine, jamais depuis `frontend/`.

### Sans fenetre native (dans un navigateur)

Utile quand Rust n'est pas installe. Deux terminaux :

```bash
cd engine && .venv\Scripts\python -m mentaliis_engine.main
```
```bash
cd frontend && npm run dev
```

Puis ouvrir `http://localhost:1420`.
Documentation interactive de l'API : `http://127.0.0.1:8756/docs`

## Produire l'application installable

```bash
npm run build
```

---

## Etat du projet

Ce qui fonctionne :

- **Vault** : ouverture d'un dossier racine, memorise et rouvert au lancement suivant.
- **Portes** : chaque dossier est une porte — ou un cerveau, au choix par clic droit —
  avec son image de vision au-dessus.
  Le nom du lieu ou l'on se trouve est rappele en capitales, tout en haut, au centre.
- **Notes** : chaque `.md` est une carte, avec titre, extrait, tags et images accrochees.
- **Traits** : relier deux elements d'une scene en tirant depuis leur poignee,
  les detacher d'un clic sur la croix. Autant de traits que voulu sur un meme
  element. Enregistres tout seuls dans le Vault.
- **Reserve de medias** : `.MEDIAS`, a la racine du Vault, d'ou viennent toutes
  les images de vision. Elle accueillera aussi sons et videos. Son nom est
  impose : le logiciel ne reconnait que celui-la, et ne la cree jamais.
- **Icones de portes** : `porte`, `cerveau`, ou vos propres icones rangees dans
  `.MEDIAS/.SVG` (svg, png, webp). Elles sont mises a l'echelle d'une porte,
  sans deformation, quelle que soit leur forme.
- **Espace** : zoom a la molette, deplacement du fond, positions persistees sur le disque.
- **Ecriture en apercu vivant** : le markdown se met en forme pendant la frappe.
  Taper `# ` donne un titre aussitot, `---` un trait, `- [ ]` une case a cocher
  cliquable. La syntaxe ne reapparait que quand le curseur entre dans l'element.
  Le fichier sur le disque, lui, reste du markdown parfaitement ordinaire.
- **Deux modes** : *ecriture* (par defaut) et *lecture*, qui verrouille le texte
  et n'affiche plus aucune syntaxe — la note y est purement consultative.
- **Titre d'une note** : affiche une seule fois, en grand, et fige. Il ne change
  que par le crayon qui apparait au survol — jamais par megarde. Le renommer met
  d'accord le frontmatter, le `# titre` du texte et le nom du fichier.
- **Parametres** : taille de l'ecriture (1×, 2×, 3×), qui n'agit que sur la zone
  d'edition, et largeur de la bande de gauche, reglable aussi en tirant son bord.
- **Blocs** : titres, listes, cases a cocher, tableaux, citations, code,
  separateurs, images, et **formules mathematiques** composees par KaTeX.
- **Bouton « + »** : inserer un bloc, un symbole mathematique (∀ ∈ ∑ ∫ π ℝ…)
  ou une image du Vault.
- **Onglets** : plusieurs notes ouvertes en meme temps, avec une bande a gauche
  qui montre la porte courante pour naviguer sans quitter le texte.
- **Liens `[[wikilink]]`** : cliquables dans le texte, avec backlinks et liens a ecrire.
- **Constellation** : tout le Vault d'un coup d'oeil, les liens tires en fils entre les notes.
- **Images** : rangees ou l'on veut dans le Vault, citees par leur seul nom
  (`![[schema.png]]`) — le moteur les retrouve dans n'importe quel sous-dossier.
- **Glisser-deposer** d'images : sur une porte pour sa vision, sur une note pour
  l'illustrer, ou directement dans le texte.
- **Surveillance du disque** : une note modifiee dans un autre editeur apparait ici aussitot.
- **Recherche** plein texte (Ctrl+K), **corbeille** dans `.mentaliis/trash/`.

### Raccourcis

| Touche | Effet |
|--------|-------|
| `Ctrl+K` | Rechercher dans tout le Vault |
| `Ctrl+G` | Basculer entre les portes et la constellation |
| `Ctrl+E` | Basculer entre ecriture et lecture |
| `Ctrl+,` | Ouvrir les parametres |
| `Ctrl+W` | Fermer l'onglet courant |
| `Ctrl+Tab` | Passer a l'onglet suivant |
| `Echap` | Refermer la note ouverte |
| Clic droit | Creer, renommer, supprimer |
| Molette | Zoomer / dezoomer |
| Clic du milieu | Deplacer la vue, ou fermer un onglet |

A venir : tags et proprietes navigables, historique des versions, themes, greffons.
