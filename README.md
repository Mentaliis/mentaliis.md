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
| Editeur markdown | CodeMirror 6 |
| Moteur | Python 3.11+ / FastAPI / Uvicorn |
| Stockage | Fichiers `.md` en clair + `.mentaliis/` (layout, cache) |

---

## Prerequis

- **Node.js** 18+
- **Python** 3.11+
- **Rust** (pour Tauri) : https://rustup.rs
- Windows : [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) + WebView2 (deja present sur Windows 10/11 a jour)

## Demarrage rapide (developpement)

Deux terminaux.

**1. Le moteur Python**

```bash
cd engine
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux
pip install -e ".[dev]"
python -m mentaliis_engine.main
```

Le moteur ecoute sur `http://127.0.0.1:8756`.
Documentation interactive de l'API : `http://127.0.0.1:8756/docs`

**2. L'interface**

```bash
cd frontend
npm install
npm run dev
```

Puis ouvrir l'URL affichee, ou lancer la vraie fenetre native :

```bash
cd frontend
npm run tauri dev
```

---

## Etat du projet

Ce qui fonctionne :

- **Vault** : ouverture d'un dossier racine, memorise et rouvert au lancement suivant.
- **Portes** : chaque dossier est une porte, avec son image de vision au-dessus.
- **Notes** : chaque `.md` est une carte, avec titre, extrait, tags et images accrochees.
- **Espace** : zoom a la molette, deplacement du fond, positions persistees sur le disque.
- **Editeur** markdown (CodeMirror 6), enregistrement automatique, apercu rendu.
- **Liens `[[wikilink]]`** : cliquables dans l'apercu, avec backlinks et liens a ecrire.
- **Constellation** : tout le Vault d'un coup d'oeil, les liens tires en fils entre les notes.
- **Glisser-deposer** d'images : sur une porte pour sa vision, sur une note pour l'illustrer.
- **Surveillance du disque** : une note modifiee dans un autre editeur apparait ici aussitot.
- **Recherche** plein texte (Ctrl+K), **corbeille** dans `.mentaliis/trash/`.

### Raccourcis

| Touche | Effet |
|--------|-------|
| `Ctrl+K` | Rechercher dans tout le Vault |
| `Ctrl+G` | Basculer entre les portes et la constellation |
| `Echap` | Refermer la note ouverte |
| Clic droit | Creer, renommer, supprimer |
| Molette | Zoomer / dezoomer |

A venir : tags et proprietes navigables, historique des versions, themes, greffons.
